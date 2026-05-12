import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSignalrService } from '../../services/game-signalr.service';
import { AuthService } from '../../../auth/auth.service';
import { GameLobbyComponent } from '../../components/game-lobby/game-lobby.component';
import { Player, Question, TurnResult, GameResult } from '../../models/game.models';
import { imageUrl } from '../../../shared/utils/image-url.utils';

@Component({
    selector: 'app-game-room',
    standalone: true,
    imports: [CommonModule, FormsModule, GameLobbyComponent],
    templateUrl: './game-room.html',
    styleUrls: ['./game-room.scss']
})
export class GameRoomComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private gameSignalrService = inject(GameSignalrService);
    private authService = inject(AuthService);

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

    ngOnInit(): void {
        const code = this.route.snapshot.paramMap.get('roomCode');
        if (!code) {
            this.errorMessage.set('Código de sala no válido');
            return;
        }

        this.roomCode.set(code);
        this.initializeConnection();
    }

    ngOnDestroy(): void {
        // DON'T call leaveGame() or disconnect() here
        // When navigating to game-play, we want to KEEP the SignalR connection
        // The user is still in the game, just viewing a different page
        //
        // If the user actually wants to leave the game (e.g., clicking "Salir de la Sala"),
        // that should call leaveGame explicitly via onLeaveGame()

        // Just reset the connected state - the connection persists
        // But since we're being destroyed, we don't need to do anything special
    }

    private initializeConnection(): void {
        // Verificar si hay usuario logueado
        const user = this.authService.getUser();
        const token = this.authService.getToken();

        if (user && token) {
            // Usuario logueado → es owner o jugador existente
            this.myUserId.set(user.id);
            this.myUsername.set(user.username);
            this.isOwner.set(true); // TODO: verificar con el hub
            this.isAnonymous.set(false);

            this.gameSignalrService.connect(token).then(() => {
                console.log('[GameRoom] Connected successfully');
                this.isConnected.set(true);
                this.setupEventHandlers();
                console.log('[GameRoom] Connection state:', this.gameSignalrService.connectionState());
            }).catch((error) => {
                console.error('[GameRoom] Error al conectar:', error);
                this.errorMessage.set('Error al conectar con el servidor de juego');
            });
        } else {
            // No hay usuario logueado → mostrar formulario para unirse como anónimo
            this.showJoinForm.set(true);
            this.isAnonymous.set(true);
        }
    }

    joinAsAnonymous(): void {
        console.log('[GameRoom] joinAsAnonymous() called');
        console.log('[GameRoom] Current anonymousUsername value:', this.anonymousUsername);

        const username = this.anonymousUsername.trim();
        console.log('[GameRoom] Username after trim:', username);

        if (!username || username.length < 2) {
            console.log('[GameRoom] Validation failed: username too short');
            this.errorMessage.set('El nombre debe tener al menos 2 caracteres');
            return;
        }

        // Generar un userId pseudo-aleatorio para el jugador anónimo
        const anonymousUserId = Math.floor(Math.random() * 1000000);
        console.log('[GameRoom] Generated anonymousUserId:', anonymousUserId);

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
        }).catch((error) => {
            console.error('[GameRoom] Error al conectar como anónimo:', error);
            this.errorMessage.set('Error al conectar con el servidor de juego');
        });
    }

    private setupEventHandlers(): void {
        console.log('[GameRoom] ★ Setting up event handlers');
        // Cuando se une exitosamente a la sala
        this.gameSignalrService.onGameCreated.subscribe((data) => {
            console.log('[GameRoom] Sala creada:', data);
            console.log('[GameRoom] Players in room:', data.players);
            console.log('[GameRoom] Is owner:', data.isOwner);

            // Add all players from GameCreated to the players list
            this.players.set(data.players || []);
            console.log('[GameRoom] Players list updated:', this.players());

            // Set owner status and user info
            this.isOwner.set(data.isOwner);
            this.myUserId.set(data.myUserId);
            this.myUsername.set(data.myUsername);
        });

        // Cuando un jugador se une
        this.gameSignalrService.onPlayerJoined.subscribe((player) => {
            console.log('[GameRoom] ★ PlayerJoined event received:', player);
            console.log('[GameRoom] ★ Current players list before update:', this.players());
            this.players.update(current => {
                const updated = [...current, player];
                console.log('[GameRoom] ★ Players list after join:', updated);
                return updated;
            });
        });

        // Cuando un jugador abandona
        this.gameSignalrService.onPlayerLeft.subscribe((playerId) => {
            console.log('[GameRoom] Jugador abandonó:', playerId);
            this.players.update(current => {
                const updated = current.filter(p => p.userId !== playerId);
                console.log('[GameRoom] Players list after leave:', updated);
                return updated;
            });
        });

        // Cuando la partida inicia
        this.gameSignalrService.onGameStarted.subscribe((gameStateDto) => {
            console.log('[GameRoom] Partida iniciada:', gameStateDto);
            this.gameState.set('playing');
        });

        // Turn started
        this.gameSignalrService.onTurnStarted.subscribe((data) => {
            console.log('[GameRoom] Turn started:', data);
            this.currentQuestion.set(data.question);
            this.currentTurnPlayerId.set(data.currentPlayerId);
            this.isMyTurn.set(data.currentPlayerId === this.myUserId());
            this.selectedAnswer.set(null);
            this.showTurnResult.set(false);
        });

        // Turn result
        this.gameSignalrService.onTurnResult.subscribe((result) => {
            console.log('[GameRoom] Turn result:', result);
            this.lastTurnResult.set(result);
            this.showTurnResult.set(true);
        });

        // Turn timeout
        this.gameSignalrService.onTurnTimeout.subscribe((data) => {
            console.log('[GameRoom] Turn timeout for player:', data.playerId);
        });

        // Game finished
        this.gameSignalrService.onGameFinished.subscribe((results) => {
            console.log('[GameRoom] Game finished:', results);
            this.gameResults.set(results);
        });

        // Errores
        this.gameSignalrService.onError.subscribe((error) => {
            console.error('[GameRoom] Error:', error);
            this.errorMessage.set(error.message);
        });

        // Players list
        this.gameSignalrService.onPlayersList.subscribe((players) => {
            console.log('[GameRoom] Players list received:', players);
            this.players.set(players);
            console.log('[GameRoom] Players list updated:', this.players());
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
        this.gameSignalrService.leaveGame(this.roomCode());
        this.router.navigate(['/']);
    }

    submitAnswer(answerIndex: number): void {
        if (!this.currentQuestion()) return;
        this.selectedAnswer.set(answerIndex);
        this.gameSignalrService.submitAnswer(
            this.roomCode(),
            this.currentQuestion()!.id,
            answerIndex,
            this.gameSignalrService.timeRemaining()
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
}
