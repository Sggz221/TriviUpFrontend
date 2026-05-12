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
}

export interface GameLobbyState {
    roomCode: string;
    quizId: number;
    players: Player[];
    isOwner: boolean;
    myUserId: number;
    myUsername: string;
}
