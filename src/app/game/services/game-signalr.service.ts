import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { GameStateDto, Player, Question, TurnResult, GameResult, TurnStartedDto } from '../models/game.models';

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
    private readonly API_URL = 'http://localhost:5164/hubs/game';

    // SignalR event subjects
    private gameCreated$ = new Subject<{ roomCode: string }>();
    private playerJoined$ = new Subject<Player>();
    private playerLeft$ = new Subject<number>();
    private gameStarting$ = new Subject<number>();
    private gameStarted$ = new Subject<GameStateDto>();
    private turnStarted$ = new Subject<TurnStartedDto>();
    private answerSubmitted$ = new Subject<{ playerId: number }>();
    private turnResult$ = new Subject<TurnResult>();
    private playerScoresUpdated$ = new Subject<Player[]>();
    private gameFinished$ = new Subject<GameResult>();
    private error$ = new Subject<{ code: string; message: string }>();

    // State signals
    isConnected = signal(false);
    currentRoomCode = signal<string | null>(null);
    connectionState = signal<GamePageState>('disconnected');

    // Observable getters for components
    onGameCreated = this.gameCreated$.asObservable();
    onPlayerJoined = this.playerJoined$.asObservable();
    onPlayerLeft = this.playerLeft$.asObservable();
    onGameStarting = this.gameStarting$.asObservable();
    onGameStarted = this.gameStarted$.asObservable();
    onTurnStarted = this.turnStarted$.asObservable();
    onAnswerSubmitted = this.answerSubmitted$.asObservable();
    onTurnResult = this.turnResult$.asObservable();
    onPlayerScoresUpdated = this.playerScoresUpdated$.asObservable();
    onGameFinished = this.gameFinished$.asObservable();
    onError = this.error$.asObservable();

    async connect(): Promise<void> {
        if (this.hubConnection?.state === HubConnectionState.Connected) {
            return;
        }

        this.connectionState.set('connecting');

        this.hubConnection = new HubConnectionBuilder()
            .withUrl(this.API_URL)
            .withAutomaticReconnect()
            .build();

        this.setupEventHandlers();

        try {
            await this.hubConnection.start();
            this.isConnected.set(true);
            this.connectionState.set('lobby');
            console.log('[GameSignalr] Connected to GameHub');
        } catch (error) {
            console.error('[GameSignalr] Connection failed:', error);
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
            this.connectionState.set('disconnected');
        }
    }

    // TODO: Implementar métodos de llamada al hub
    // async createGame(quizId: number): Promise<string>
    // async joinGame(roomCode: string): Promise<void>
    // async leaveGame(roomCode: string): Promise<void>
    // async startGame(roomCode: string): Promise<void>
    // async submitAnswer(roomCode: string, questionId: number, answerIndex: number): Promise<void>

    private setupEventHandlers(): void {
        if (!this.hubConnection) return;

        // TODO: Registrar handlers para todos los eventos del hub
        // this.hubConnection.on('GameCreated', (data) => this.gameCreated$.next(data));
        // this.hubConnection.on('PlayerJoined', (data) => this.playerJoined$.next(data));
        // ... etc
    }
}
