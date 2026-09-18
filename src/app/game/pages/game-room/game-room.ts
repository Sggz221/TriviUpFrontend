import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameSignalrService } from '../../services/game-signalr.service';
import { AuthService } from '../../../auth/auth.service';
import { GameLobbyComponent } from '../../components/game-lobby/game-lobby.component';
import { GameScoreboardComponent } from '../../components/game-scoreboard/game-scoreboard.component';
import { Player, Question, TurnResult, GameResult } from '../../models/game.models';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { AudioService } from '../../../shared/services/audio.service';
import { AnswerShapeComponent, ShapeType } from '../../../shared/components/answer-shape/answer-shape';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { getOrCreateAnonymousUserId, saveAnonymousIdentity, touchAnonymousIdentity } from '../../utils/anonymous-identity.utils';

@Component({
    selector: 'app-game-room',
    standalone: true,
    imports: [CommonModule, FormsModule, GameLobbyComponent, GameScoreboardComponent, AnswerShapeComponent, IconComponent],
    templateUrl: './game-room.html',
    styleUrls: ['./game-room.scss']
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

    private showTurnBanner(): void {
        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.turnBanner.set(this.getCurrentTurnPlayerName());
        this.bannerTimeout = setTimeout(() => this.turnBanner.set(null), 2000);
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

                // If user is NOT the owner, join the game room
                if (!this.isOwner()) {
                    console.log('[GameRoom] User is not owner, joining game room...');
                    return this.gameSignalrService.joinGame(this.roomCode(), this.myUserId(), this.myUsername());
                }
                return Promise.resolve();
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
            saveAnonymousIdentity(this.roomCode(), anonymousUserId, username);
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
        this.gameSignalrService.onRoomClosed.pipe(takeUntil(this.destroy$)).subscribe(() => {
            console.log('[GameRoom] La sala fue cerrada por el anfitrión');
            this.errorMessage.set('El anfitrión cerró la sala');
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
            this.showTurnBanner();
            if (isMyTurn) {
                this.audioService.playTurnStart();
                this.startLocalTimer(data.timeLimit);
            }
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
        });

        // Turn timeout
        this.gameSignalrService.onTurnTimeout.pipe(takeUntil(this.destroy$)).subscribe((data) => {
            console.log('[GameRoom] Turn timeout for player:', data.playerId);
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

    onLeaveGame(): void {
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

    submitAnswer(answerIndex: number): void {
        if (!this.currentQuestion()) return;
        this.selectedAnswer.set(answerIndex);
        this.gameSignalrService.submitAnswer(
            this.roomCode(),
            this.currentQuestion()!.id,
            answerIndex,
            this.turnTimeLimit() > 0 ? this.localTimeRemaining() : 0
        );
    }

    getCurrentTurnPlayerName(): string {
        const currentId = this.currentTurnPlayerId();
        if (!currentId) return 'jugador';
        const player = this.players().find(p => p.userId === currentId);
        return player?.username || 'jugador';
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
