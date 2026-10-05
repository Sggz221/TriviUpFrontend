export type GameState = 'Waiting' | 'Starting' | 'Playing' | 'Finished';

/** Presencial: el anfitrión marca y confirma las respuestas; los jugadores solo usan comodines. */
export type GameMode = 'Normal' | 'Presencial';

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
    /** Usos que le quedan de cada comodín que aún puede usar. */
    remainingUses?: Partial<Record<ComodinTipo, number>> | null;
    /** Usos máximos por jugador de cada comodín activo en la sala (los ausentes están desactivados). */
    maxUses?: Partial<Record<ComodinTipo, number>> | null;
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
    /** El jugador pasó la pregunta con el comodín Pasar: ni acierto ni fallo. */
    passed?: boolean;
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
    mode?: GameMode;
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
    mode?: GameMode;
    /** Presencial: opción marcada por el anfitrión y aún sin confirmar. */
    markedAnswerIndex?: number | null;
    /** Ya se usó algún comodín en esta pregunta: no se puede robar. */
    comodinUsed?: boolean;
    /** Presencial: hay una Llamada en curso y su cartel sigue en pantalla. */
    callActive?: boolean;
    /** Pregunta de pulsador: nadie tiene turno, el primer equipo en pulsar se lleva la pregunta. */
    isDynamic?: boolean;
    /** Pregunta de pulsador: el pulsador sigue abierto (currentPlayerId = 0 hasta que alguien pulse). */
    buzzerOpen?: boolean;
    /** Jugador al que se le oculta el texto de las respuestas en esta pregunta. */
    textHiddenForPlayerId?: number | null;
    /** Pregunta de colores (isDynamic también es true: no tiene turno). */
    isColor?: boolean;
    /** Prueba de colores abierta: todos imitan colorTarget (currentPlayerId = 0 hasta que haya ganador). */
    colorOpen?: boolean;
    colorTarget?: ColorHsb | null;
    /** Jugadores que ya han enviado su color (sin revelar cuál). */
    colorSubmittedPlayerIds?: number[] | null;
}

/** Color en HSB: tono 0-359, saturación y brillo 0-100. */
export interface ColorHsb {
    hue: number;
    saturation: number;
    brightness: number;
}

/** Pregunta de colores: alguien ha enviado su color. */
export interface ColorSubmittedDto {
    questionId: number;
    playerId: number;
}

export interface ColorGuess {
    playerId: number;
    username: string;
    color: ColorHsb;
    /** Parecido con el objetivo, 0-100. */
    similarity: number;
}

/** Resultado de la prueba de colores: colores de todos (el ganador primero) y ganador (null si nadie envió). */
export interface ColorChallengeResultDto {
    questionId: number;
    target: ColorHsb;
    guesses: ColorGuess[];
    winnerId: number | null;
    winnerUsername: string | null;
    tieBroken: boolean;
}

/** Pregunta de pulsador: el equipo que ha pulsado primero. */
export interface BuzzerWonDto {
    questionId: number;
    playerId: number;
    username: string;
}

/** Presencial: el anfitrión quitó el cartel de la Llamada. */
export interface CallDismissedDto {
    questionId: number;
}

/** Presencial: el anfitrión marcó (o desmarcó, con null) una opción. */
export interface AnswerMarkedDto {
    questionId: number;
    answerIndex: number | null;
}

/** Presencial: respuesta correcta de la pregunta en curso (solo le llega al anfitrión). */
export interface HostQuestionInfoDto {
    questionId: number;
    /** Solo en modo presencial; null en otro caso. */
    correctAnswerIndex: number | null;
    /** Dato curioso de la pregunta (se muestra al anfitrión tras revelarse la respuesta). */
    curiosidad?: string | null;
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
    mode?: GameMode;
}

export type ComodinTipo = 'Ruleta' | 'DobleONada' | 'Robo' | 'Apuesta' | 'Llamada' | 'CincuentaCincuenta' | 'Pasar' | 'OcultarTexto' | 'CambiarPregunta' | 'CambiarPreguntaRival';

/** Comodines que se usan en el turno propio; el resto, fuera de él. */
export const COMODINES_DE_TURNO: readonly ComodinTipo[] = ['Ruleta', 'DobleONada', 'Llamada', 'CincuentaCincuenta', 'Pasar', 'CambiarPregunta'];

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
    /** Hueco de la ruleta en el que cae (índice en RULETA_HUECOS). */
    ruletaHueco?: number | null;
    /** Lo que dura la animación; el servidor alarga el turno este tiempo. */
    ruletaDuracionMs?: number | null;
    /** Usos que le quedan al jugador de cada comodín. */
    remainingUses?: Partial<Record<ComodinTipo, number>> | null;
    /** Jugador afectado por el comodín (Ocultar texto: quien responde). */
    targetPlayerId?: number | null;
}
