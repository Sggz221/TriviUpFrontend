import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { GameStateDto, Player, Question, TurnResult, GameResult, TurnStartedDto, GameLobbyState } from '../models/game.models';

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
    | 'game-over'
    | 'error';

@Injectable({
    providedIn: 'root'
})
export class GameSignalrService {
    private hubConnection: HubConnection | null = null;
    private isAnonymousConnection = false;
    private anonymousUserId: number | null = null;
    private anonymousUsername: string | null = null;

    // Build hub URL dynamically based on environment
    private getHubUrl(): string {
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        // Use window.location.hostname which will be the actual IP when accessed from mobile
        const host = window.location.hostname;
        const port = 5164; // Backend port
        return `${protocol}//${host}:${port}/hubs/game`;
    }

    // SignalR event subjects
    private gameCreated$ = new Subject<GameLobbyState>();
    private playerJoined$ = new Subject<Player>();
    private playerLeft$ = new Subject<number>();
    private gameStarting$ = new Subject<number>();
    private gameStarted$ = new Subject<GameStateDto>();
    private turnStarted$ = new Subject<TurnStartedDto>();
    private turnTimeout$ = new Subject<{ playerId: number }>();
    private answerSubmitted$ = new Subject<{ playerId: number }>();
    private turnResult$ = new Subject<TurnResult>();
    private playerScoresUpdated$ = new Subject<Player[]>();
    private gameFinished$ = new Subject<GameResult>();
    private playersList$ = new Subject<Player[]>();
    private error$ = new Subject<{ code: string; message: string }>();

    // State signals
    isConnected = signal(false);
    currentRoomCode = signal<string | null>(null);
    connectionState = signal<GamePageState>('disconnected');
    currentQuestion = signal<Question | null>(null);
    currentTurnPlayerId = signal<number | null>(null);
    timeRemaining = signal<number>(0);
    isMyTurn = signal<boolean>(false);
    quizTitle = signal<string>('');
    gameResults = signal<GameResult | null>(null);

    // Observable getters for components
    onGameCreated = this.gameCreated$.asObservable();
    onPlayerJoined = this.playerJoined$.asObservable();
    onPlayerLeft = this.playerLeft$.asObservable();
    onGameStarting = this.gameStarting$.asObservable();
    onGameStarted = this.gameStarted$.asObservable();
    onTurnStarted = this.turnStarted$.asObservable();
    onTurnTimeout = this.turnTimeout$.asObservable();
    onAnswerSubmitted = this.answerSubmitted$.asObservable();
    onTurnResult = this.turnResult$.asObservable();
    onPlayerScoresUpdated = this.playerScoresUpdated$.asObservable();
    onGameFinished = this.gameFinished$.asObservable();
    onPlayersList = this.playersList$.asObservable();
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
            .withUrl(hubUrl, token ? { accessTokenFactory: () => token } : {})
            .withAutomaticReconnect()
            .build();

        this.setupEventHandlers();

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
            .withAutomaticReconnect()
            .build();

        this.setupEventHandlers();

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

    private setupEventHandlers(): void {
        if (!this.hubConnection) return;

        console.log('[GameSignalr] Setting up event handlers');

        this.hubConnection.on('GameCreated', (data: GameLobbyState) => {
            console.log('[GameSignalr] Event: GameCreated', data);
            this.gameCreated$.next(data);
        });
        this.hubConnection.on('PlayerJoined', (data: Player) => {
            console.log('[GameSignalr] Event: PlayerJoined', data);
            this.playerJoined$.next(data);
        });
        this.hubConnection.on('PlayerLeft', (data: number) => {
            console.log('[GameSignalr] Event: PlayerLeft', data);
            this.playerLeft$.next(data);
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
            console.log('[GameSignalr] Event: PlayersList', data);
            this.playersList$.next(data);
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
    async createGame(quizId: number): Promise<string> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        return this.hubConnection.invoke('CreateGame', quizId);
    }

    /**
     * Join a game room (anonymous - passes userId and username as parameters)
     */
    async joinGame(roomCode: string): Promise<void> {
        if (!this.hubConnection) throw new Error('Hub not connected');
        if (this.anonymousUserId === null || this.anonymousUsername === null) {
            throw new Error('Anonymous user not configured');
        }
        return this.hubConnection.invoke('JoinGame', roomCode, this.anonymousUserId, this.anonymousUsername);
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
}
