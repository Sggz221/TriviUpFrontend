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
    isSpectator?: boolean;
    /** Comodines que aún puede usar (vacío para anfitrión y espectadores). */
    availableComodines?: ComodinTipo[] | null;
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
    isSteal?: boolean;
    doubleOrNothing?: boolean;
    /** Robo fallido: jugador al que vuelve la pregunta. */
    returnsToPlayerId?: number | null;
    bets?: BetResult[] | null;
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
    /** Jugador al que le tocaba el turno (currentPlayerId es quien responde: el ladrón durante un robo). */
    turnOwnerId?: number | null;
    isSteal?: boolean;
    eliminatedAnswerIndexes?: number[] | null;
    doubleOrNothingPlayers?: number[] | null;
    bets?: Bet[] | null;
    stolenById?: number | null;
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

export type ComodinTipo = 'Ruleta' | 'DobleONada' | 'Robo' | 'Apuesta';

/** Comodines que se usan en el turno propio; el resto, fuera de él. */
export const COMODINES_DE_TURNO: readonly ComodinTipo[] = ['Ruleta', 'DobleONada'];

export interface Bet {
    userId: number;
    predictsCorrect: boolean;
}

export interface BetResult extends Bet {
    won: boolean;
    /** Anulada porque el ladrón acertó: se devuelve el comodín. */
    refunded: boolean;
    pointsEarned: number;
    newTotalScore: number;
}

export interface ComodinUsedDto {
    userId: number;
    username: string;
    tipo: ComodinTipo;
    questionId: number;
    availableComodines: ComodinTipo[];
    eliminatedAnswerIndexes?: number[] | null;
    ruletaResultado?: number | null;
    predictsCorrect?: boolean | null;
    stolenFromPlayerId?: number | null;
}
