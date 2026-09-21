export type GameState = 'Waiting' | 'Starting' | 'Playing' | 'Finished';

export interface Player {
    userId: number;
    username: string;
    score: number;
    correctAnswers: number;
    wrongAnswers: number;
    isCurrentTurn: boolean;
    isOwner: boolean;
    isConnected: boolean;
}

export interface Question {
    id: number;
    text: string;
    options: string[];
    imageUrl?: string;
}

export interface TurnResult {
    playerId: number;
    isCorrect: boolean;
    correctAnswerIndex: number;
    pointsEarned: number;
    newTotalScore: number;
}

export interface GameResult {
    roomCode: string;
    quizTitle: string;
    playerResults: PlayerResult[];
    totalQuestions: number;
    gameDuration: number;
}

export interface PlayerResult {
    userId: number;
    username: string;
    rank: number;
    finalScore: number;
    correctAnswers: number;
    wrongAnswers: number;
    correctPercentage: number;
}

export interface GameStateDto {
    roomCode: string;
    state: GameState;
    players: Player[];
    currentQuestionIndex: number;
    totalQuestions: number;
}

export interface TurnStartedDto {
    currentPlayerId: number;
    isMyTurn: boolean;
    question: Question;
    timeLimit: number;
    faseNumero?: number;
    faseNombre?: string | null;
    totalFases?: number;
    faseColor?: string | null;
}

/** Fase en curso (solo se muestra cuando la partida tiene más de una). */
export interface PhaseInfo {
    numero: number;
    nombre: string | null;
    total: number;
    /** Color ya resuelto (el configurado o el de la paleta por defecto). */
    color: string;
}

/** Intermedio al terminar una fase: marcador y datos de la siguiente. */
export interface PhaseCompletedDto {
    roomCode: string;
    faseNumero: number;
    faseNombre?: string | null;
    siguienteFaseNombre?: string | null;
    totalFases: number;
    players: Player[];
    faseColor?: string | null;
    siguienteFaseNumero?: number;
    siguienteFaseColor?: string | null;
}

export interface GameLobbyState {
    roomCode: string;
    quizId: number;
    players: Player[];
    isOwner: boolean;
    myUserId: number;
    myUsername: string;
}
