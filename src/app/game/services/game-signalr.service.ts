import { Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { GameStateDto, Player, Question, TurnResult, GameResult, TurnStartedDto, GameLobbyState } from '../models/game.models';
import { getApiBaseUrl } from '../../shared/utils/api-url.utils';
import { AuthService } from '../../auth/auth.service';

export type GamePageState =
    | 'disconnected'
    | 'connecting'
    | 'joining'
    | 'lobby'
    | 'countdown'
    | 'playing'
    | 'turn-waiting'
    | 'turn-active'
    | 'turn-result'
    | 'paused'
    | 'game-over'
    | 'error';

@Injectable({
    providedIn: 'root'
})
export class GameSignalrService {
    private hubConnection: HubConnection | null = null;
    private authService = inject(AuthService);
    private intentionalStop = false;
    private static readonly RETRY_DELAYS = [0, 2000, 5000, 10000, 20000, 30000, 30000, 30000];
    private isAnonymousConnection = false;
    private anonymousUserId: number | null = null;
    private anonymousUsername: string | null = null;

    // Build hub URL dynamically based on environment
    private getHubUrl(): string {
        const apiBaseUrl = getApiBaseUrl();
        if (apiBaseUrl) {
            // Producción: el backend ya no está detrás de un proxy de nginx,
            // se llama directamente a su dominio público.
            return `${apiBaseUrl}/hubs/game`;
        }
        // Local (ng serve): usar el host actual (permite probar desde el móvil en la LAN)
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const host = window.location.hostname;
        return `${protocol}//${host}/hubs/game`;
    }

    // SignalR event subjects
    private gameCreated$ = new Subject<GameLobbyState>();
    private playerJoined$ = new Subject<Player>();
    private playerLeft$ = new Subject<number>();
    private playerKicked$ = new Subject<number>();
    private roomClosed$ = new Subject<{ roomCode: string; reason: string }>();
    private gameStarting$ = new Subject<number>();
    private gameStarted$ = new Subject<GameStateDto>();
    private turnStarted$ = new Subject<TurnStartedDto>();
    private turnTimeout$ = new Subject<{ playerId: number }>();
    private answerSubmitted$ = new Subject<{ playerId: number }>();
    private turnResult$ = new Subject<TurnResult>();
    private playerScoresUpdated$ = new Subject<Player[]>();
    private gameFinished$ = new Subject<GameResult>();
    private playersList$ = new Subject<Player[]>();
    private gamePaused$ = new Subject<{ roomCode: string }>();
    private gameResumed$ = new Subject<{ roomCode: string; timeRemaining: number }>();
    private error$ = new Subject<{ code: string; message: string }>();

    // State signals
    isConnected = signal(false);
    reconnecting = signal(false);
    currentRoomCode = signal<string | null>(null);
    connectionState = signal<GamePageState>('disconnected');
    currentQuestion = signal<Question | null>(null);
    currentTurnPlayerId = signal<number | null>(null);
    timeRemaining = signal<number>(0);
    isMyTurn = signal<boolean>(false);
    quizTitle = signal<string>('');
    gameResults = signal<GameResult | null>(null);
    isPaused = signal<boolean>(false);
    isOwner = signal<boolean>(false);
    players = signal<Player[]>([]);
    currentUserId = signal<number | null>(null);
    currentUsername = signal<string | null>(null);

    // Observable getters for components
    onGameCreated = this.gameCreated$.asObservable();
    onPlayerJoined = this.playerJoined$.asObservable();
    onPlayerLeft = this.playerLeft$.asObservable();
    onPlayerKicked = this.playerKicked$.asObservable();
    onRoomClosed = this.roomClosed$.asObservable();
    onGameStarting = this.gameStarting$.asObservable();
    onGameStarted = this.gameStarted$.asObservable();
    onTurnStarted = this.turnStarted$.asObservable();
    onTurnTimeout = this.turnTimeout$.asObservable();
    onAnswerSubmitted = this.answerSubmitted$.asObservable();
    onTurnResult = this.turnResult$.asObservable();
    onPlayerScoresUpdated = this.playerScoresUpdated$.asObservable();
    onGameFinished = this.gameFinished$.asObservable();
    onPlayersList = this.playersList$.asObservable();
    onGamePaused = this.gamePaused$.asObservable();
    onGameResumed = this.gameResumed$.asObservable();
    onError = this.error$.asObservable();

    /**
     * Connect with JWT authentication (for logged-in users)
     */
    async connect(token?: string): Promise<void> {
        if (this.hubConnection?.state === HubConnectionState.Connected) {
            console.log('[GameSignalr] Already connected, skipping');
            return;
        }

        this.connectionState.set('connecting');
        this.isAnonymousConnection = false;

        const hubUrl = this.getHubUrl();
        console.log('[GameSignalr] Connecting to:', hubUrl);
        console.log('[GameSignalr] Connection state before start:', this.hubConnection?.state);

        this.hubConnection = new HubConnectionBuilder()
            .withUrl(hubUrl, token ? { accessTokenFactory: () => this.authService.getToken() ?? token } : {})
            .withAutomaticReconnect(GameSignalrService.RETRY_DELAYS)
            .build();

        this.intentionalStop = false;
        this.setupEventHandlers();
        this.setupLifecycleHandlers();

        try {
            await this.hubConnection.start();
            console.log('[GameSignalr] Connection started, state:', this.hubConnection.state);
            this.isConnected.set(true);
            this.connectionState.set('lobby');
            console.log('[GameSignalr] Connected to GameHub (authenticated)');
        } catch (error) {
            console.error('[GameSignalr] Connection failed:', error);
            this.connectionState.set('error');
            throw error;
        }
    }

    /**
     * Connect anonymously (for players joining without authentication)
     * @param userId User ID for identification in the hub
     * @param username Username for display in the lobby
     */
    async connectAnonymously(userId: number, username: string): Promise<void> {
        if (this.hubConnection?.state === HubConnectionState.Connected) {
            console.log('[GameSignalr] Already connected, skipping');
            return;
        }

        this.connectionState.set('connecting');
        this.isAnonymousConnection = true;
        this.anonymousUserId = userId;
        this.anonymousUsername = username;

        const hubUrl = this.getHubUrl();
        console.log('[GameSignalr] Connecting anonymously to:', hubUrl);
        console.log('[GameSignalr] Anonymous userId:', userId, 'username:', username);

        this.hubConnection = new HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect(GameSignalrService.RETRY_DELAYS)
            .build();

        this.intentionalStop = false;
        this.setupEventHandlers();
        this.setupLifecycleHandlers();

        try {
            await this.hubConnection.start();
            console.log('[GameSignalr] Anonymous connection started, state:', this.hubConnection.state);
            this.isConnected.set(true);
            this.connectionState.set('lobby');
            console.log('[GameSignalr] Connected to GameHub (anonymous)');
        } catch (error) {
            console.error('[GameSignalr] Anonymous connection failed:', error);
            this.connectionState.set('error');
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        this.intentionalStop = true;
        if (this.hubConnection) {
            await this.hubConnection.stop();
            this.hubConnection = null;
            this.isConnected.set(false);
            this.currentRoomCode.set(null);
            this.isAnonymousConnection = false;
            this.anonymousUserId = null;
            this.anonymousUsername = null;
            this.connectionState.set('disconnected');
        }
    }

    /**
     * Reconexión: SignalR pierde la pertenencia a los grupos al reconectar (cambia el
     * connectionId), así que hay que volver a hacer JoinGame. Si la reconexión
     * automática se agota, se reintenta manualmente hasta que el usuario salga.
     */
    private setupLifecycleHandlers(): void {
        const connection = this.hubConnection;
        if (!connection) return;

        connection.onreconnecting(() => {
            console.warn('[GameSignalr] Reconnecting...');
            this.reconnecting.set(true);
        });

        connection.onreconnected(async () => {
            console.log('[GameSignalr] Reconnected, rejoining room');
            this.reconnecting.set(false);
            this.isConnected.set(true);
            await this.rejoinCurrentRoom();
        });

        connection.onclose(async () => {
            this.isConnected.set(false);
            if (this.intentionalStop || this.hubConnection !== connection) return;
            this.reconnecting.set(true);
            await this.retryStart(connection);
        });
    }

    private async retryStart(connection: HubConnection): Promise<void> {
        while (!this.intentionalStop && this.hubConnection === connection) {
            try {
                await connection.start();
                this.reconnecting.set(false);
                this.isConnected.set(true);
                await this.rejoinCurrentRoom();
                return;
            } catch {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    private async rejoinCurrentRoom(): Promise<void> {
        const roomCode = this.currentRoomCode();
        const userId = this.currentUserId();
        const username = this.currentUsername();
        if (!roomCode || userId === null || username === null || !this.hubConnection) return;
        try {
            await this.hubConnection.invoke('JoinGame', roomCode, userId, username);
        } catch (error) {
            console.error('[GameSignalr] Rejoin failed:', error);
        }
    }

    private setupEventHandlers(): void {
        if (!this.hubConnection) return;

        console.log('[GameSignalr] Setting up event handlers');

        this.hubConnection.on('GameCreated', (data: GameLobbyState) => {
            console.log('[GameSignalr] Event: GameCreated', data);
            this.players.set(data.players || []);
            this.currentUserId.set(data.myUserId);
            this.currentUsername.set(data.myUsername);
            this.gameCreated$.next(data);
        });
        this.hubConnection.on('PlayerJoined', (data: Player) => {
            console.log('[GameSignalr] ★★★ Event: PlayerJoined received!', JSON.stringify(data));
            console.log('[GameSignalr] ★★★ PlayerJoined data.userId:', data.userId);
            console.log('[GameSignalr] ★★★ PlayerJoined data.username:', data.username);
            // Add to players list if not already present
            const current = this.players();
            if (!current.find(p => p.userId === data.userId)) {
                this.players.set([...current, data]);
            }
            this.playerJoined$.next(data);
            console.log('[GameSignalr] ★★★ PlayerJoined event emitted to subscribers');
        });
        this.hubConnection.on('PlayerLeft', (data: number) => {
            console.log('[GameSignalr] Event: PlayerLeft', data);
            this.playerLeft$.next(data);
        });
        this.hubConnection.on('PlayerKicked', (data: number) => {
            console.log('[GameSignalr] Event: PlayerKicked', data);
            this.playerKicked$.next(data);
        });
        this.hubConnection.on('RoomClosed', (data: { roomCode: string; reason: string }) => {
            console.log('[GameSignalr] Event: RoomClosed', data);
            this.roomClosed$.next(data);
        });
        this.hubConnection.on('GameStarting', (data: number) => {
            console.log('[GameSignalr] Event: GameStarting', data);
            this.gameStarting$.next(data);
        });
        this.hubConnection.on('GameStarted', (data: GameStateDto) => {
            console.log('[GameSignalr] Event: GameStarted', data);
            this.gameStarted$.next(data);
        });
        this.hubConnection.on('TurnStarted', (data: TurnStartedDto) => {
            console.log('[GameSignalr] Event: TurnStarted', data);
            this.currentQuestion.set(data.question);
            this.currentTurnPlayerId.set(data.currentPlayerId);
            this.isMyTurn.set(data.isMyTurn);
            this.timeRemaining.set(data.timeLimit);
            this.turnStarted$.next(data);
        });
        this.hubConnection.on('TurnTimeout', (data: { playerId: number }) => {
            console.log('[GameSignalr] Event: TurnTimeout', data);
            this.turnTimeout$.next(data);
        });
        this.hubConnection.on('AnswerSubmitted', (data: { playerId: number }) => {
            console.log('[GameSignalr] Event: AnswerSubmitted', data);
            this.answerSubmitted$.next(data);
        });
        this.hubConnection.on('TurnResult', (data: TurnResult) => {
            console.log('[GameSignalr] Event: TurnResult', data);
            this.turnResult$.next(data);
        });
        this.hubConnection.on('PlayerScoresUpdated', (data: Player[]) => {
            console.log('[GameSignalr] Event: PlayerScoresUpdated', data);
            this.playerScoresUpdated$.next(data);
        });
        this.hubConnection.on('GameFinished', (data: GameResult) => {
            console.log('[GameSignalr] Event: GameFinished', data);
            this.gameResults.set(data);
            this.gameFinished$.next(data);
        });
        this.hubConnection.on('PlayersList', (data: Player[]) => {
            console.log('[GameSignalr] ★★★ Event: PlayersList received!', JSON.stringify(data));
            console.log('[GameSignalr] ★★★ PlayersList count:', data?.length);
            this.players.set(data);  // Store in service signal for persistence
            this.playersList$.next(data);
            console.log('[GameSignalr] ★★★ PlayersList event emitted to subscribers');
        });
        this.hubConnection.on('GamePaused', (data: { roomCode: string }) => {
            console.log('[GameSignalr] Event: GamePaused', data);
            this.isPaused.set(true);
            this.gamePaused$.next(data);
        });
        this.hubConnection.on('GameResumed', (data: { roomCode: string; timeRemaining: number }) => {
            console.log('[GameSignalr] Event: GameResumed', data);
            this.isPaused.set(false);
            this.timeRemaining.set(data.timeRemaining);
            this.gameResumed$.next(data);
        });
        this.hubConnection.on('Error', (data: { code: string; message: string }) => {
            console.log('[GameSignalr] Event: Error', data);
            this.error$.next(data);
        });
    }

    // ============ Public Hub Methods ============

    /**
     * Create a new game room (requires authenticated user)
     */
    async createGame(quizId: number, turnTimeLimitSeconds: number | null = null): Promise<string> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        const roomCode = await this.hubConnection.invoke<string>('CreateGame', quizId, turnTimeLimitSeconds);
        this.currentRoomCode.set(roomCode);
        return roomCode;
    }

    /**
     * Join a game room
     * @param roomCode The room code to join
     * @param userId Optional user ID (for logged-in users). If not provided, uses anonymousUserId
     * @param username Optional username (for logged-in users). If not provided, uses anonymousUsername
     */
    async joinGame(roomCode: string, userId?: number, username?: string): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');

        // Use provided values for logged-in users, or fall back to anonymous values
        const effectiveUserId = userId ?? this.anonymousUserId;
        const effectiveUsername = username ?? this.anonymousUsername;

        if (effectiveUserId === null || effectiveUsername === null) {
            throw new Error('User not configured: provide userId/username or use connectAnonymously() first');
        }

        // Store user info in service signals for persistence across navigation
        this.currentUserId.set(effectiveUserId);
        this.currentUsername.set(effectiveUsername);

        this.currentRoomCode.set(roomCode);
        return this.hubConnection.invoke('JoinGame', roomCode, effectiveUserId, effectiveUsername);
    }

    /**
     * Leave a game room
     */
    async leaveGame(roomCode: string): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        if (this.anonymousUserId !== null) {
            return this.hubConnection.invoke('LeaveGame', roomCode, this.anonymousUserId);
        }
        return this.hubConnection.invoke('LeaveGame', roomCode, 0);
    }

    /**
     * Start the game (requires authenticated user who is the owner)
     */
    async startGame(roomCode: string): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        return this.hubConnection.invoke('StartGame', roomCode);
    }

    /**
     * Submit an answer (anonymous - passes userId as parameter)
     */
    async submitAnswer(roomCode: string, questionId: number, answerIndex: number, timeRemaining: number): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        if (this.anonymousUserId === null) {
            throw new Error('Anonymous user not configured');
        }
        return this.hubConnection.invoke('SubmitAnswer', roomCode, this.anonymousUserId, questionId, answerIndex, timeRemaining);
    }

    /**
     * Pause the game (requires owner)
     */
    async pauseGame(roomCode: string): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        return this.hubConnection.invoke('PauseGame', roomCode);
    }

    /**
     * Resume the game (requires owner)
     */
    async resumeGame(roomCode: string): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        return this.hubConnection.invoke('ResumeGame', roomCode);
    }

    /**
     * Kick a player from the game room (requires owner)
     */
    async kickPlayer(roomCode: string, playerId: number): Promise<void> {
        console.log('[GameSignalr] kickPlayer called - roomCode:', roomCode, 'playerId:', playerId);
        if (!this.hubConnection) {
            console.error('[GameSignalr] Hub not connected!');
            throw new Error('Hub not connected');
        }
        console.log('[GameSignalr] Invoking KickPlayer hub method...');
        return this.hubConnection.invoke('KickPlayer', roomCode, playerId);
    }

    /**
     * Set whether the current user is the owner of the room
     */
    setIsOwner(value: boolean): void {
        console.log('[GameSignalr] ★★★ setIsOwner called with:', value);
        console.log('[GameSignalr] ★★★ isOwner signal BEFORE set:', this.isOwner());
        this.isOwner.set(value);
        console.log('[GameSignalr] ★★★ isOwner signal AFTER set:', this.isOwner());
    }

    /**
     * Clear all game state (used when leaving a game)
     */
    clearGameState(): void {
        this.isOwner.set(false);
        this.currentRoomCode.set(null);
        this.quizTitle.set('');
        this.currentQuestion.set(null);
        this.currentTurnPlayerId.set(null);
        this.timeRemaining.set(0);
        this.isMyTurn.set(false);
        this.gameResults.set(null);
        this.isPaused.set(false);
        this.players.set([]);
        this.currentUserId.set(null);
        this.currentUsername.set(null);
    }
}
