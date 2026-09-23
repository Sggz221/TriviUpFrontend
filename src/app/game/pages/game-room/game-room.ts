import { Component, OnInit, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameSignalrService } from '../../services/game-signalr.service';
import { AuthService } from '../../../auth/auth.service';
import { GameLobbyComponent } from '../../components/game-lobby/game-lobby.component';
import { GameScoreboardComponent } from '../../components/game-scoreboard/game-scoreboard.component';
import { PhaseLeaderboardComponent } from '../../components/phase-leaderboard/phase-leaderboard.component';
import { Player, Question, TurnResult, GameResult, PhaseInfo, PhaseCompletedDto, Bet, ComodinTipo, ComodinUsedDto, TurnStartedDto } from '../../models/game.models';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { colorDeFase, textoSobreColor } from '../../../cuestionarios/models/fase-color';
import { AudioService } from '../../../shared/services/audio.service';
import { AnswerShapeComponent, ShapeType } from '../../../shared/components/answer-shape/answer-shape';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { clearAnonymousIdentity, getOrCreateAnonymousUserId, getSavedAnonymousIdentity, saveAnonymousIdentity, touchAnonymousIdentity } from '../../utils/anonymous-identity.utils';

@Component({
    selector: 'app-game-room',
    standalone: true,
    imports: [CommonModule, FormsModule, GameLobbyComponent, GameScoreboardComponent, PhaseLeaderboardComponent, AnswerShapeComponent, IconComponent],
    templateUrl: './game-room.html',
    styleUrls: ['./game-room.scss', './game-room-comodines.scss']
})
export class GameRoomComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    gameSignalrService = inject(GameSignalrService);
    private authService = inject(AuthService);
    private audioService = inject(AudioService);

    roomCode = signal<string>('');
    players = signal<Player[]>([]);
    isOwner = signal<boolean>(false);
    myUserId = signal<number>(0);
    /** Espectador asignado por el anfitrión: ve la partida pero nunca tiene turno. */
    isSpectator = computed(() => !!this.players().find(p => p.userId === this.myUserId())?.isSpectator);
    myUsername = signal<string>('');
    quizTitle = signal<string>('');
    errorMessage = signal<string | null>(null);
    isConnected = signal<boolean>(false);
    isAnonymous = signal<boolean>(false);
    showJoinForm = signal<boolean>(false);
    isStarting = signal<boolean>(false);
    anonymousUsername = '';
    gameState = signal<'lobby' | 'playing'>('lobby');
    currentQuestion = signal<Question | null>(null);
    isMyTurn = signal<boolean>(false);
    currentTurnPlayerId = signal<number | null>(null);
    selectedAnswer = signal<number | null>(null);
    showTurnResult = signal<boolean>(false);
    lastTurnResult = signal<TurnResult | null>(null);
    gameResults = signal<GameResult | null>(null);
    isMuted = signal<boolean>(false);
    isPaused = signal<boolean>(false);
    localTimeRemaining = signal<number>(0);
    /** Segundos totales del turno actual (0 = sin límite de tiempo). */
    turnTimeLimit = signal<number>(0);
    /** Nombre mostrado en el banner "Turno de: ..." (null = oculto). */
    turnBanner = signal<string | null>(null);
    /** Etiqueta del banner de turno ("Turno de:" o "¡Robo!"). */
    turnBannerLabel = signal<string>('Turno de:');

    // ---- Comodines (estado de la pregunta en curso) ----
    /** Respuestas eliminadas por la ruleta. */
    eliminatedAnswers = signal<number[]>([]);
    doubleOrNothingPlayers = signal<number[]>([]);
    bets = signal<Bet[]>([]);
    /** Jugador al que le tocaba la pregunta (currentTurnPlayerId es quien responde: el ladrón durante un robo). */
    turnOwnerId = signal<number | null>(null);
    isSteal = signal<boolean>(false);
    stolenById = signal<number | null>(null);
    usingComodin = signal<boolean>(false);
    betPickerOpen = signal<boolean>(false);
    /** Ruleta girando: resultado final y giro de la rueda hasta él. */
    ruletaSpin = signal<{ username: string; resultado: number; rotation: number; revealed: boolean } | null>(null);
    toasts = signal<{ id: number; text: string; tone: 'info' | 'success' | 'error' }[]>([]);
    private toastSeq = 0;
    private static readonly RULETA_SPIN_MS = 1400;
    /** Porcentaje de la rueda para eliminar 0, 1, 2 y 3 respuestas (mismos pesos que el servidor). */
    static readonly RULETA_PESOS = [10, 30, 45, 15];
    readonly ruletaSegmentos = GameRoomComponent.buildRuletaSegmentos();

    private me = computed(() => this.players().find(p => p.userId === this.myUserId()));
    myComodines = computed<ComodinTipo[]>(() => this.me()?.availableComodines ?? []);
    /** Jugador (no anfitrión ni espectador) con una pregunta activa y sin pausa ni resultado en pantalla. */
    canUseComodines = computed(() =>
        !!this.me() && !this.isOwner() && !this.isSpectator() && !!this.currentQuestion()
        && !this.showTurnResult() && !this.isPaused() && !this.phaseBreak() && this.selectedAnswer() === null);
    private iBet = computed(() => this.bets().some(b => b.userId === this.myUserId()));
    canUseRuleta = computed(() => this.canUseComodines() && this.isMyTurn() && this.hasComodin('Ruleta') && !this.ruletaSpin());
    canUseDobleONada = computed(() => this.canUseComodines() && this.isMyTurn() && this.hasComodin('DobleONada')
        && !this.doubleOrNothingPlayers().includes(this.myUserId()));
    canRobar = computed(() => this.canUseComodines() && !this.isMyTurn() && this.hasComodin('Robo')
        && this.stolenById() === null && !this.iBet() && this.turnOwnerId() !== this.myUserId());
    canApostar = computed(() => this.canUseComodines() && !this.isMyTurn() && this.hasComodin('Apuesta')
        && !this.isSteal() && this.stolenById() !== this.myUserId() && !this.iBet() && this.turnOwnerId() !== this.myUserId());
    /** Doble o nada activo para quien responde ahora. */
    answererDoubleOrNothing = computed(() => {
        const id = this.currentTurnPlayerId();
        return id !== null && this.doubleOrNothingPlayers().includes(id);
    });
    /** Fase en curso (null si la partida no tiene varias fases). */
    phase = signal<PhaseInfo | null>(null);
    /** Intermedio entre fases: marcador a la espera de que el anfitrión continúe. */
    phaseBreak = signal<PhaseCompletedDto | null>(null);
    isContinuing = signal<boolean>(false);
    /** Clasificación del intermedio anterior (o ceros en el primero), para animar las subidas y bajadas. */
    phaseBreakPrevious = signal<Player[] | null>(null);
    /** Fase cuyo banner grande se está mostrando (null = oculto). */
    phaseBanner = signal<PhaseInfo | null>(null);
    /** Colores del intermedio: el de la fase que acaba y el de la siguiente. */
    colorIntermedio = computed(() => colorDeFase(this.phaseBreak()?.faseNumero, this.phaseBreak()?.faseColor));
    colorSiguiente = computed(() => colorDeFase(this.phaseBreak()?.siguienteFaseNumero, this.phaseBreak()?.siguienteFaseColor));
    readonly textoSobreColor = textoSobreColor;
    private lastBannerPhase: number | null = null;
    private lastPhaseBreakPlayers: Player[] | null = null;
    private sawTurn = false;
    private phaseBannerTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Duración del banner de fase; el "Turno de:" espera a que termine. */
    private static readonly PHASE_BANNER_MS = 2800;
    private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Evita unirse dos veces (Enter + clic) y crear dos conexiones con ids distintos. */
    isJoining = signal<boolean>(false);
    private handlersRegistered = false;
    private destroy$ = new Subject<void>();
    private activityTimer: ReturnType<typeof setInterval> | null = null;
    private timerInterval: ReturnType<typeof setInterval> | null = null;

    // Shape colors: triangle=red, square=yellow, circle=blue, pentagon=purple
    getShapeType(index: number): ShapeType {
        const shapes: ShapeType[] = ['triangle', 'square', 'circle', 'pentagon'];
        return shapes[index % 4];
    }

    getShapeClass(index: number): string {
        return `shape-${this.getShapeType(index)}`;
    }

    ngOnInit(): void {
        // Load muted state from localStorage
        this.isMuted.set(this.audioService.muted());

        const code = this.route.snapshot.paramMap.get('roomCode');
        if (!code) {
            this.errorMessage.set('Código de sala no válido');
            return;
        }

        this.roomCode.set(code);

        // Check if user is the owner from the service (set when creating a game)
        // The service's isOwner signal persists across component navigation
        console.log('[GameRoom] ★★★ ngOnInit - checking isOwner from service');
        console.log('[GameRoom] ★★★ service.isOwner():', this.gameSignalrService.isOwner());
        console.log('[GameRoom] ★★★ component isOwner BEFORE:', this.isOwner());

        if (this.gameSignalrService.isOwner()) {
            this.isOwner.set(true);
            console.log('[GameRoom] ★★★ component isOwner AFTER (set to true):', this.isOwner());
        } else {
            console.log('[GameRoom] ★★★ component isOwner AFTER (stays false):', this.isOwner());
        }

        console.log('[GameRoom] ★★★ Final component isOwner:', this.isOwner());

        this.initializeConnection();

        // Mantener viva la identidad anónima mientras el jugador está en la sala
        this.activityTimer = setInterval(() => touchAnonymousIdentity(this.roomCode()), 60 * 1000);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.activityTimer) clearInterval(this.activityTimer);
        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        if (this.phaseBannerTimeout) clearTimeout(this.phaseBannerTimeout);
        // DON'T call leaveGame() or disconnect() here
        // When navigating to game-play, we want to KEEP the SignalR connection
        // The user is still in the game, just viewing a different page
        //
        // If the user actually wants to leave the game (e.g., clicking "Salir de la Sala"),
        // that should call leaveGame explicitly via onLeaveGame()

        // Just reset the connected state - the connection persists
        // But since we're being destroyed, we don't need to do anything special

        // Clear timer interval to prevent memory leaks
        this.clearTimerInterval();
    }

    private clearTimerInterval(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    private showTurnBanner(retrasoMs = 0, label = 'Turno de:', texto?: string): void {
        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.turnBanner.set(null);
        this.bannerTimeout = setTimeout(() => {
            this.turnBannerLabel.set(label);
            this.turnBanner.set(texto ?? this.getCurrentTurnPlayerName());
            this.bannerTimeout = setTimeout(() => this.turnBanner.set(null), 2000);
        }, retrasoMs);
    }

    /** Banner grande al empezar cada fase (una vez por fase); devuelve cuánto dura, para retrasar el "Turno de:". */
    private mostrarBannerFase(fase: PhaseInfo | null): number {
        if (!fase || fase.numero === this.lastBannerPhase) return 0;

        this.lastBannerPhase = fase.numero;
        if (this.phaseBannerTimeout) clearTimeout(this.phaseBannerTimeout);
        this.phaseBanner.set(fase);
        this.phaseBannerTimeout = setTimeout(() => this.phaseBanner.set(null), GameRoomComponent.PHASE_BANNER_MS);
        return GameRoomComponent.PHASE_BANNER_MS;
    }

    private startLocalTimer(timeLimit: number): void {
        this.clearTimerInterval();
        this.localTimeRemaining.set(timeLimit);
        if (timeLimit <= 0) return;
        this.timerInterval = setInterval(() => {
            this.localTimeRemaining.update(t => Math.max(0, t - 1));
        }, 1000);
    }

    private initializeConnection(): void {
        // Verificar si hay usuario logueado
        const user = this.authService.getUser();
        const token = this.authService.getToken();

        if (user && token) {
            // Usuario logueado → puede ser owner o jugador
            this.myUserId.set(user.id);
            this.myUsername.set(user.username);
            // NO establecer isOwner aquí - ya se configuró en ngOnInit desde el servicio
            this.isAnonymous.set(false);

            console.log('[GameRoom] initializeConnection - user logged in, isOwner stays:', this.isOwner());

            this.gameSignalrService.connect(token).then(() => {
                console.log('[GameRoom] Connected successfully');
                this.isConnected.set(true);
                this.setupEventHandlers();
                console.log('[GameRoom] Connection state:', this.gameSignalrService.connectionState());

                // Semilla inicial desde el signal del servicio (poblado por GameCreated
                // si acabamos de crear la sala en QuizDetail, antes de navegar aquí).
                // Sin esto el propio owner ve "Jugadores (0)" hasta que se una alguien más.
                const servicePlayers = this.gameSignalrService.players();
                if (servicePlayers.length > 0) {
                    this.players.set(servicePlayers);
                    this.syncOwnershipFromPlayers(servicePlayers);
                }

                // Unirse siempre (también el owner): JoinGame es idempotente para quien ya está
                // en la sala y reenvía el estado de una partida en curso. Si el owner se saltara
                // este paso al volver a entrar, se quedaría en el lobby sin recibir la pregunta.
                return this.gameSignalrService.joinGame(this.roomCode(), this.myUserId(), this.myUsername());
            }).then(() => {
                console.log('[GameRoom] joinGame() succeeded (if called)');
            }).catch((error) => {
                console.error('[GameRoom] Error al conectar:', error);
                this.errorMessage.set('Error al conectar con el servidor de juego');
            });
        } else {
            // No hay usuario logueado → mostrar formulario para unirse como anónimo
            // PERO si ya está conectado vía SignalR (ej: joined via /unirse page), no mostrar formulario
            if (this.gameSignalrService.isConnected()) {
                console.log('[GameRoom] Already connected via SignalR, skipping join form');
                this.isConnected.set(true);
                this.isAnonymous.set(true);
                // Set user info and players from service signals (stored during join)
                const serviceUserId = this.gameSignalrService.currentUserId();
                const serviceUsername = this.gameSignalrService.currentUsername();
                const servicePlayers = this.gameSignalrService.players();
                if (serviceUserId !== null) {
                    this.myUserId.set(serviceUserId);
                    console.log('[GameRoom] Set myUserId from service:', serviceUserId);
                }
                if (serviceUsername !== null) {
                    this.myUsername.set(serviceUsername);
                    console.log('[GameRoom] Set myUsername from service:', serviceUsername);
                }
                if (servicePlayers.length > 0) {
                    this.players.set(servicePlayers);
                    console.log('[GameRoom] Set players from service:', servicePlayers.length);
                }
                this.setupEventHandlers();

                // JoinGame (desde /unirse) pudo reenviar el estado de una partida en curso
                // antes de que este componente registrara sus handlers: recuperarlo del servicio.
                const question = this.gameSignalrService.currentQuestion();
                if (question) {
                    const turnPlayerId = this.gameSignalrService.currentTurnPlayerId();
                    this.currentQuestion.set(question);
                    this.currentTurnPlayerId.set(turnPlayerId);
                    this.isMyTurn.set(turnPlayerId !== null && turnPlayerId === serviceUserId);
                    this.turnTimeLimit.set(this.gameSignalrService.timeRemaining());
                    this.gameState.set('playing');
                    this.isPaused.set(this.gameSignalrService.isPaused());
                    this.phase.set(this.gameSignalrService.currentPhase());
                    const lastTurn = this.gameSignalrService.lastTurnStarted();
                    if (lastTurn) this.applyTurnState(lastTurn);
                    if (this.isMyTurn() && !this.isPaused()) {
                        this.startLocalTimer(this.gameSignalrService.timeRemaining());
                    }
                }
                const phaseBreak = this.gameSignalrService.phaseBreak();
                if (phaseBreak) {
                    this.phaseBreak.set(phaseBreak);
                    this.gameState.set('playing');
                }
                return;
            }

            // Reconexión tras refresh/caída: si ya tenemos identidad de esta sala,
            // volvemos a entrar solos en vez de pedir el nombre otra vez.
            const saved = getSavedAnonymousIdentity(this.roomCode());
            if (saved) {
                this.isAnonymous.set(true);
                this.anonymousUsername = saved.username;
                this.joinAsAnonymous();
                return;
            }
            this.showJoinForm.set(true);
            this.isAnonymous.set(true);
        }
    }

    joinAsAnonymous(): void {
        if (this.isJoining()) return;
        console.log('[GameRoom] joinAsAnonymous() called');
        console.log('[GameRoom] Current anonymousUsername value:', this.anonymousUsername);

        const username = this.anonymousUsername.trim();
        console.log('[GameRoom] Username after trim:', username);

        if (!username || username.length < 2) {
            console.log('[GameRoom] Validation failed: username too short');
            this.errorMessage.set('El nombre debe tener al menos 2 caracteres');
            return;
        }

        // Reutilizar el userId anónimo de esta sala si ya existe (ej: venimos de un refresh),
        // para que el backend nos reconozca como el mismo jugador reconectando en vez de
        // crear una fila duplicada en la lista de jugadores.
        const anonymousUserId = getOrCreateAnonymousUserId(this.roomCode());
        console.log('[GameRoom] Using anonymousUserId:', anonymousUserId);

        this.isJoining.set(true);
        this.errorMessage.set(null);
        // Guardar ya la identidad: si algo reintenta, reutilizará este mismo id
        saveAnonymousIdentity(this.roomCode(), anonymousUserId, username);

        console.log('[GameRoom] Calling connectAnonymously()...');
        this.gameSignalrService.connectAnonymously(anonymousUserId, username).then(() => {
            console.log('[GameRoom] connectAnonymously() succeeded');
            this.myUserId.set(anonymousUserId);
            this.myUsername.set(username);
            this.showJoinForm.set(false);
            this.isConnected.set(true);
            this.setupEventHandlers();
            console.log('[GameRoom] Connection state:', this.gameSignalrService.connectionState());

            // IMPORTANT: Now call joinGame to actually join the room
            console.log('[GameRoom] Calling joinGame()...');
            return this.gameSignalrService.joinGame(this.roomCode());
        }).then(() => {
            console.log('[GameRoom] joinGame() succeeded');
            console.log('[GameRoom] joinAsAnonymous() completed successfully');
            // El id con el que el servidor nos registró es el del servicio: única fuente de verdad
            const registeredId = this.gameSignalrService.currentUserId();
            if (registeredId !== null) {
                this.myUserId.set(registeredId);
                saveAnonymousIdentity(this.roomCode(), registeredId, username);
            }
            this.isJoining.set(false);
        }).catch((error) => {
            console.error('[GameRoom] Error al conectar como anónimo:', error);
            this.errorMessage.set('Error al conectar con el servidor de juego');
            this.isJoining.set(false);
        });
    }

    /**
     * Deriva si el usuario actual es el owner a partir de la lista de jugadores
     * recibida del servidor, en vez de depender solo del evento GameCreated (que
     * no vuelve a dispararse tras un refresh). Sin esto, tras un F5 el owner
     * pierde el QR y el botón de "Iniciar Partida" aunque el backend lo siga
     * reconociendo como owner.
     */
    private syncOwnershipFromPlayers(players: Player[]): void {
        const me = players.find(p => p.userId === this.myUserId());
        if (me && me.isOwner !== this.isOwner()) {
            this.isOwner.set(me.isOwner);
            this.gameSignalrService.setIsOwner(me.isOwner);
        }
    }

    private setupEventHandlers(): void {
        if (this.handlersRegistered) return;
        this.handlersRegistered = true;
        console.log('[GameRoom] ★ Setting up event handlers');
        // Cuando se une exitosamente a la sala
        this.gameSignalrService.onGameCreated.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] ★★★ GameCreated event received!');
            console.log('[GameRoom] ★★★ data:', JSON.stringify(data));
            console.log('[GameRoom] ★★★ data.isOwner:', data.isOwner);
            console.log('[GameRoom] ★★★ data.myUserId:', data.myUserId);
            console.log('[GameRoom] ★★★ data.myUsername:', data.myUsername);
            console.log('[GameRoom] ★★★ data.players:', JSON.stringify(data.players));

            // Add all players from GameCreated to the players list
            this.players.set(data.players || []);
            console.log('[GameRoom] ★★★ Players list updated:', this.players());

            // Set owner status and user info (both component and service)
            console.log('[GameRoom] ★★★ Setting component isOwner to:', data.isOwner);
            this.isOwner.set(data.isOwner);
            console.log('[GameRoom] ★★★ Setting service isOwner to:', data.isOwner);
            this.gameSignalrService.setIsOwner(data.isOwner);
            this.myUserId.set(data.myUserId);
            this.myUsername.set(data.myUsername);

            console.log('[GameRoom] ★★★ Final component isOwner:', this.isOwner());
        });

        // Cuando un jugador se une
        this.gameSignalrService.onPlayerJoined.pipe(takeUntil(this.destroy$)).subscribe((player) => {
            console.log('[GameRoom] ★★★ PlayerJoined event received!:', JSON.stringify(player));
            console.log('[GameRoom] ★★★ Current players list before update:', JSON.stringify(this.players()));
            this.players.update(current => {
                // Check if player already exists to prevent duplicates
                if (current.some(p => p.userId === player.userId)) {
                    console.log('[GameRoom] ★★★ Player already exists, skipping duplicate:', player.userId);
                    return current;
                }
                const updated = [...current, player];
                console.log('[GameRoom] ★★★ Players list after join:', JSON.stringify(updated));
                return updated;
            });
            this.syncOwnershipFromPlayers(this.players());
        });

        // Cuando un jugador abandona
        this.gameSignalrService.onPlayerLeft.pipe(takeUntil(this.destroy$)).subscribe((playerId) => {
            console.log('[GameRoom] Jugador abandonó:', playerId);
            this.players.update(current => {
                const updated = current.filter(p => p.userId !== playerId);
                console.log('[GameRoom] Players list after leave:', updated);
                return updated;
            });
        });

        // Cuando un jugador es expulsado
        this.gameSignalrService.onPlayerKicked.pipe(takeUntil(this.destroy$)).subscribe((playerId) => {
            console.log('[GameRoom] Jugador expulsado:', playerId);
            // Check if the kicked player is the current user
            if (playerId === this.myUserId()) {
                console.log('[GameRoom] You were kicked from the game!');
                this.errorMessage.set('Has sido expulsado de la sala');
                clearAnonymousIdentity(this.roomCode());
                // Redirect to home after a short delay
                setTimeout(() => {
                    this.router.navigate(['/']);
                }, 2000);
            } else {
                // Remove the player from the list
                this.players.update(current => {
                    const updated = current.filter(p => p.userId !== playerId);
                    console.log('[GameRoom] Players list after kick:', updated);
                    return updated;
                });
            }
        });

        // Cuando el anfitrión cierra la sala (salió explícitamente mientras se esperaba)
        this.gameSignalrService.onRoomClosed.pipe(takeUntil(this.destroy$)).subscribe(({ reason }) => {
            console.log('[GameRoom] La sala fue cerrada:', reason);
            this.errorMessage.set(reason === 'NO_PLAYERS'
                ? 'La sala se cerró: el anfitrión se fue y solo quedaban espectadores'
                : 'El anfitrión cerró la sala');
            setTimeout(() => {
                this.router.navigate(['/']);
            }, 2000);
        });

        // Cuando la partida inicia
        this.gameSignalrService.onGameStarted.pipe(takeUntil(this.destroy$)).subscribe((gameStateDto) => {
            console.log('[GameRoom] Partida iniciada:', gameStateDto);
            this.gameState.set('playing');
            this.audioService.playTurnStart();
        });

        // Turn started
        this.gameSignalrService.onTurnStarted.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] Turn started:', data);
            this.currentQuestion.set(data.question);
            this.currentTurnPlayerId.set(data.currentPlayerId);
            const isMyTurn = data.currentPlayerId === this.myUserId();
            this.isMyTurn.set(isMyTurn);
            this.gameState.set('playing');
            this.isPaused.set(false);
            this.selectedAnswer.set(null);
            this.showTurnResult.set(false);
            this.turnTimeLimit.set(data.timeLimit);
            this.phaseBreak.set(null);
            this.isContinuing.set(false);
            this.sawTurn = true;
            const fase: PhaseInfo | null = data.totalFases && data.totalFases > 1
                ? { numero: data.faseNumero ?? 1, nombre: data.faseNombre ?? null, total: data.totalFases, color: colorDeFase(data.faseNumero, data.faseColor) }
                : null;
            this.phase.set(fase);
            this.applyTurnState(data);
            this.betPickerOpen.set(false);
            if (data.isSteal) {
                this.showTurnBanner(0, '¡Robo!', `${this.playerName(data.currentPlayerId)} roba a ${this.playerName(data.turnOwnerId)}`);
            } else {
                this.showTurnBanner(this.mostrarBannerFase(fase));
            }
            if (isMyTurn) {
                this.audioService.playTurnStart();
                this.startLocalTimer(data.timeLimit);
            }
        });

        // Intermedio entre fases
        this.gameSignalrService.onPhaseCompleted.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] Phase completed:', data);
            this.clearTimerInterval();
            this.gameState.set('playing');
            this.isMyTurn.set(false);
            this.isContinuing.set(false);
            // Para animar: la clasificación del intermedio anterior o, en el primero, todos a cero
            const alcanzado = this.lastPhaseBreakPlayers
                ?? (this.sawTurn ? data.players.map(j => ({ ...j, score: 0, correctAnswers: 0, wrongAnswers: 0 })) : null);
            this.phaseBreakPrevious.set(alcanzado);
            this.lastPhaseBreakPlayers = data.players;
            this.phaseBreak.set(data);
            this.players.set(data.players);
            this.syncOwnershipFromPlayers(data.players);
        });

        // Turn result
        this.gameSignalrService.onTurnResult.pipe(takeUntil(this.destroy$)).subscribe((result) => {
            console.log('[GameRoom] Turn result:', result);
            this.lastTurnResult.set(result);
            this.showTurnResult.set(true);
            this.clearTimerInterval();
            if (result.isCorrect) {
                this.audioService.playCorrect();
            } else {
                this.audioService.playWrong();
            }
            this.applyTurnOutcome(result, false);
        });

        // Turn timeout
        this.gameSignalrService.onTurnTimeout.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] Turn timeout for player:', data.playerId);
            this.applyTurnOutcome(data, true);
        });

        // Comodín usado por cualquier jugador
        this.gameSignalrService.onComodinUsed.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] Comodín usado:', data);
            this.onComodinUsed(data);
        });

        // Game finished
        this.gameSignalrService.onGameFinished.pipe(takeUntil(this.destroy$)).subscribe((results) => {
            console.log('[GameRoom] Game finished:', results);
            this.gameResults.set(results);
            this.audioService.playGameOver();
        });

        // Errores
        this.gameSignalrService.onError.pipe(takeUntil(this.destroy$)).subscribe((error) => {
            console.error('[GameRoom] Error:', error);
            this.errorMessage.set(error.message);
        });

        // Players list
        this.gameSignalrService.onPlayersList.pipe(takeUntil(this.destroy$)).subscribe((players) => {
            console.log('[GameRoom] ★★★ PlayersList event received!:', JSON.stringify(players));
            console.log('[GameRoom] ★★★ Current players before update:', JSON.stringify(this.players()));
            this.players.set(players);
            console.log('[GameRoom] ★★★ Players list after update:', JSON.stringify(this.players()));
            this.syncOwnershipFromPlayers(players);
        });

        // Game paused
        this.gameSignalrService.onGamePaused.pipe(takeUntil(this.destroy$)).subscribe(() => {
            console.log('[GameRoom] Game paused');
            this.isPaused.set(true);
            this.clearTimerInterval();
        });

        // Game resumed
        this.gameSignalrService.onGameResumed.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] Game resumed with', data.timeRemaining, 'seconds');
            this.isPaused.set(false);
            this.startLocalTimer(data.timeRemaining);
        });
    }

    onStartGame(): void {
        if (this.isStarting()) {
            return;
        }
        this.isStarting.set(true);
        this.gameSignalrService.startGame(this.roomCode()).catch((error) => {
            console.error('[GameRoom] Error al iniciar:', error);
            this.errorMessage.set('Error al iniciar la partida');
        }).finally(() => {
            this.isStarting.set(false);
        });
    }

    /** El anfitrión sale del intermedio y arranca la siguiente fase. */
    onContinuePhase(): void {
        if (this.isContinuing()) return;
        this.isContinuing.set(true);
        this.gameSignalrService.continuePhase(this.roomCode()).catch((error) => {
            console.error('[GameRoom] Error al continuar a la siguiente fase:', error);
            this.errorMessage.set('No se pudo continuar a la siguiente fase');
            this.isContinuing.set(false);
        });
    }

    onLeaveGame(): void {
        clearAnonymousIdentity(this.roomCode());
        this.gameSignalrService.leaveGame(this.roomCode())
            .catch((error) => console.error('[GameRoom] Error al notificar salida de la sala:', error))
            .finally(() => {
                // Cerrar la conexión SignalR por completo: si no, al volver a entrar
                // connectAnonymously() la ve como "ya conectada" y no actualiza el
                // nombre/usuario nuevo que se escriba en el formulario de unión.
                this.gameSignalrService.disconnect();
                this.gameSignalrService.clearGameState();
                this.router.navigate(['/']);
            });
    }

    onKickPlayer(playerId: number): void {
        console.log('[GameRoom] Kicking player:', playerId);
        this.gameSignalrService.kickPlayer(this.roomCode(), playerId);
    }

    onToggleSpectator({ userId, isSpectator }: { userId: number; isSpectator: boolean }): void {
        this.gameSignalrService.setSpectator(this.roomCode(), userId, isSpectator).catch(err => {
            console.error('[GameRoom] Error cambiando rol de espectador:', err);
            this.errorMessage.set('No se pudo cambiar el rol del jugador');
        });
    }

    submitAnswer(answerIndex: number): void {
        if (!this.currentQuestion() || this.isEliminated(answerIndex) || this.ruletaSpin()) return;
        this.selectedAnswer.set(answerIndex);
        this.betPickerOpen.set(false);
        this.gameSignalrService.submitAnswer(this.roomCode(), this.currentQuestion()!.id, answerIndex)
            .catch((error) => {
                console.error('[GameRoom] Error al responder:', error);
                this.selectedAnswer.set(null);
            });
    }

    getCurrentTurnPlayerName(): string {
        return this.playerName(this.currentTurnPlayerId());
    }

    playerName(userId: number | null | undefined): string {
        if (!userId) return 'jugador';
        return this.players().find(p => p.userId === userId)?.username || 'jugador';
    }

    // ============ Comodines ============

    hasComodin(tipo: ComodinTipo): boolean {
        return this.myComodines().includes(tipo);
    }

    isEliminated(index: number): boolean {
        return this.eliminatedAnswers().includes(index);
    }

    useComodin(tipo: ComodinTipo, predictsCorrect: boolean | null = null): void {
        const question = this.currentQuestion();
        if (!question || this.usingComodin()) return;
        this.usingComodin.set(true);
        this.betPickerOpen.set(false);
        this.gameSignalrService.useComodin(this.roomCode(), tipo, question.id, predictsCorrect)
            .catch((error) => {
                console.error('[GameRoom] Error al usar comodín:', error);
                this.showToast(this.hubErrorMessage(error, 'No se pudo usar el comodín'), 'error');
            })
            .finally(() => this.usingComodin.set(false));
    }

    toggleBetPicker(): void {
        this.betPickerOpen.update(open => !open);
    }

    betLabel(bet: Bet): string {
        return `${this.playerName(bet.userId)}: ${bet.predictsCorrect ? 'acierta' : 'falla'}`;
    }

    /** Estado de comodines que trae cada TurnStarted (nuevo turno, robo, vuelta al original o reconexión). */
    private applyTurnState(data: TurnStartedDto): void {
        this.turnOwnerId.set(data.turnOwnerId ?? data.currentPlayerId);
        this.isSteal.set(!!data.isSteal);
        this.stolenById.set(data.stolenById ?? null);
        this.eliminatedAnswers.set(data.eliminatedAnswerIndexes ?? []);
        this.doubleOrNothingPlayers.set(data.doubleOrNothingPlayers ?? []);
        this.bets.set(data.bets ?? []);
    }

    private onComodinUsed(data: ComodinUsedDto): void {
        this.players.update(list => list.map(p =>
            p.userId === data.userId ? { ...p, availableComodines: data.availableComodines } : p));
        if (data.questionId !== this.currentQuestion()?.id) return;

        const nombre = data.username;
        switch (data.tipo) {
            case 'Ruleta':
                this.spinRuleta(data);
                break;
            case 'DobleONada':
                this.doubleOrNothingPlayers.update(ids => [...ids, data.userId]);
                this.showToast(`${nombre}: ¡Doble o nada! (+200 / −100)`, 'info');
                break;
            case 'Robo':
                this.stolenById.set(data.userId);
                this.showToast(`${nombre} roba la pregunta a ${this.playerName(data.stolenFromPlayerId)}`, 'info');
                break;
            case 'Apuesta':
                this.bets.update(b => [...b, { userId: data.userId, predictsCorrect: !!data.predictsCorrect }]);
                this.showToast(`${nombre} apuesta a que ${this.playerName(this.turnOwnerId())} ${data.predictsCorrect ? 'acierta' : 'falla'}`, 'info');
                break;
        }
    }

    /** Anima la rueda hasta el resultado del servidor y después tacha las respuestas. */
    private spinRuleta(data: ComodinUsedDto): void {
        const resultado = data.ruletaResultado ?? data.eliminatedAnswerIndexes?.length ?? 0;
        const segmento = this.ruletaSegmentos[Math.min(resultado, this.ruletaSegmentos.length - 1)];
        // El puntero está arriba: girar varias vueltas y dejar el centro del segmento bajo él
        const jitter = (Math.random() - 0.5) * (segmento.end - segmento.start) * 0.6;
        const rotation = 360 * 5 - (segmento.center + jitter);
        const nombre = data.username;
        this.ruletaSpin.set({ username: nombre, resultado, rotation, revealed: false });

        setTimeout(() => {
            this.eliminatedAnswers.update(prev => [...new Set([...prev, ...(data.eliminatedAnswerIndexes ?? [])])]);
            this.ruletaSpin.update(s => s ? { ...s, revealed: true } : s);
        }, GameRoomComponent.RULETA_SPIN_MS);
        setTimeout(() => this.ruletaSpin.set(null), GameRoomComponent.RULETA_SPIN_MS + 900);
    }

    /** Puntuaciones, apuestas y avisos al resolverse una respuesta (o un timeout). */
    private applyTurnOutcome(result: TurnResult, timedOut: boolean): void {
        const scores = new Map<number, number>([[result.playerId, result.newTotalScore]]);
        for (const bet of result.bets ?? []) scores.set(bet.userId, bet.newTotalScore);
        const refunded = new Set((result.bets ?? []).filter(b => b.refunded).map(b => b.userId));
        this.players.update(list => list.map(p => {
            if (!scores.has(p.userId) && !refunded.has(p.userId)) return p;
            const comodines = p.availableComodines ?? [];
            return {
                ...p,
                score: scores.get(p.userId) ?? p.score,
                availableComodines: refunded.has(p.userId) && !comodines.includes('Apuesta') ? [...comodines, 'Apuesta'] : comodines
            };
        }));

        const nombre = this.playerName(result.playerId);
        if (result.isSteal && !result.isCorrect) {
            const motivo = timedOut ? 'se quedó sin tiempo en' : 'falló';
            this.showToast(`${nombre} ${motivo} el robo (${result.pointsEarned} pts). La pregunta vuelve a ${this.playerName(result.returnsToPlayerId)}`, 'error');
        } else if (result.doubleOrNothing && !result.isCorrect && result.pointsEarned < 0) {
            this.showToast(`${nombre}: Doble o nada fallido (${result.pointsEarned} pts)`, 'error');
        }

        for (const bet of result.bets ?? []) {
            const quien = this.playerName(bet.userId);
            if (bet.refunded) {
                this.showToast(`Apuesta de ${quien} anulada: se devuelve el comodín`, 'info');
            } else if (bet.won) {
                this.showToast(`${quien} gana la apuesta (+${bet.pointsEarned})`, 'success');
            } else {
                this.showToast(`${quien} pierde la apuesta`, 'error');
            }
        }
    }

    private showToast(text: string, tone: 'info' | 'success' | 'error'): void {
        const id = ++this.toastSeq;
        this.toasts.update(t => [...t.slice(-3), { id, text, tone }]);
        setTimeout(() => this.toasts.update(t => t.filter(x => x.id !== id)), 3500);
    }

    /** Extrae el mensaje de una HubException ("... HubException: mensaje"). */
    private hubErrorMessage(error: unknown, fallback: string): string {
        const message = error instanceof Error ? error.message : String(error ?? '');
        const idx = message.lastIndexOf('HubException:');
        return idx >= 0 ? message.slice(idx + 'HubException:'.length).trim() : fallback;
    }

    private static buildRuletaSegmentos(): { valor: number; start: number; end: number; center: number; color: string }[] {
        const colores = ['#64748b', '#0ea5e9', '#c757ba', '#ed5381'];
        const total = GameRoomComponent.RULETA_PESOS.reduce((a, b) => a + b, 0);
        let acumulado = 0;
        return GameRoomComponent.RULETA_PESOS.map((peso, valor) => {
            const start = (acumulado / total) * 360;
            acumulado += peso;
            const end = (acumulado / total) * 360;
            return { valor, start, end, center: (start + end) / 2, color: colores[valor] };
        });
    }

    ruletaGradient(): string {
        return `conic-gradient(${this.ruletaSegmentos.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})`;
    }

    getImageUrl(url: string | null | undefined): string {
        return imageUrl(url);
    }

    toggleMute(): void {
        this.audioService.toggleMute();
        this.isMuted.set(this.audioService.muted());
    }

    togglePause(): void {
        const roomCode = this.roomCode();
        if (!roomCode) return;

        if (this.isPaused()) {
            this.gameSignalrService.resumeGame(roomCode);
        } else {
            this.gameSignalrService.pauseGame(roomCode);
        }
    }

    formatGameDuration(duration: number | string | null | undefined): string {
        if (duration == null || duration === '') return '';

        if (typeof duration === 'string') {
            // TimeSpan often serializes as "00:05:32" or "05:32"
            const parts = duration.split(':').map(Number);
            if (parts.length >= 3 && parts.every(n => !Number.isNaN(n))) {
                const hours = parts[0];
                const mins = parts[1];
                const secs = Math.floor(parts[2]);
                return hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
            }
            if (parts.length === 2 && parts.every(n => !Number.isNaN(n))) {
                return `${parts[0]}m ${parts[1]}s`;
            }
            return duration;
        }

        const totalSecs = Math.max(0, Math.floor(duration));
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}m ${secs}s`;
    }
}
