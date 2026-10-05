/** Dificultad de una pregunta; null/ausente = sin clasificar. */
export type Dificultad = 'facil' | 'media' | 'dificil';

export const DIFICULTADES: { valor: Dificultad; etiqueta: string; color: string }[] = [
    { valor: 'facil', etiqueta: 'Fácil', color: 'var(--success)' },
    { valor: 'media', etiqueta: 'Media', color: 'var(--warning)' },
    { valor: 'dificil', etiqueta: 'Difícil', color: 'var(--error)' }
];

export function etiquetaDificultad(valor: string | null | undefined): string | null {
    return DIFICULTADES.find(d => d.valor === valor)?.etiqueta ?? null;
}

export function colorDificultad(valor: string | null | undefined): string {
    return DIFICULTADES.find(d => d.valor === valor)?.color ?? 'var(--neutral)';
}

export interface Respuesta {
    id: number;
    preguntaId: number;
    texto: string;
    esCorrecta: boolean;
}

/** Tipo de pregunta: normal (por turnos) o pulsador (responde el primer equipo en pulsar desde su móvil). */
export type TipoPregunta = 'normal' | 'pulsador';

export interface Pregunta {
    id: number;
    quizId: number;
    creatorId: number;
    numeroPregunta: number;
    enunciado: string;
    respuestas: Respuesta[];
    /** Fase (bloque) a la que pertenece, empezando en 1. */
    faseNumero?: number;
    /** Nombre libre de la fase (ronda, categoría, dificultad...). */
    faseNombre?: string | null;
    /** Color de la fase (#rrggbb); ausente = color por defecto según el número de fase. */
    faseColor?: string | null;
    /** Tipo de pregunta; ausente = normal. */
    tipo?: TipoPregunta;
    dificultad?: Dificultad | null;
    imagenUrl?: string | null;
    /** Dato curioso: en la partida solo lo ve el anfitrión, tras revelarse la respuesta. */
    curiosidad?: string | null;
}

export interface Cuestionario {
    id: number;
    nombre: string;
    esPublico: boolean;
    esBorrador?: boolean;
    /** Versión publicada actual (0 = nunca publicado). */
    version?: number;
    /** Un cuestionario publicado tiene un borrador pendiente aparte. */
    tieneBorrador?: boolean;
    gameCode: string;
    preguntas: Pregunta[];
    /** Fases con pool: sus preguntas se sortean del banco del autor en cada partida. */
    pools?: FasePool[];
    creatorId: number;
    fechaCreacion: string;
    fechaActualizacion: string;
}

export interface CreateQuizRequest {
    nombre: string;
    esPublico: boolean;
    esBorrador?: boolean;
    preguntas: {
        numeroPregunta: number;
        enunciado: string;
        respuestas: { texto: string; esCorrecta: boolean }[];
        imagenUrl?: string;
        faseNumero: number;
        faseNombre?: string;
        faseColor?: string;
        tipo?: TipoPregunta;
        dificultad?: Dificultad;
        curiosidad?: string;
    }[];
    pools?: FasePool[];
}

/** De dónde salen las preguntas de un pool: elegidas a mano del banco o por filtros. */
export type OrigenPool = 'manual' | 'filtros';

/** Pregunta del banco elegida a mano para un pool (el enunciado es solo para mostrarlo). */
export interface FasePoolPregunta {
    id: number;
    enunciado: string;
}

/**
 * Fase sin preguntas fijas: en cada partida se sortean `cantidad` preguntas del banco del autor.
 * Ocupa su número de fase igual que las fases de preguntas.
 */
export interface FasePool {
    faseNumero: number;
    faseNombre?: string | null;
    faseColor?: string | null;
    cantidad: number;
    origen: OrigenPool;
    /** Origen manual: preguntas del banco entre las que se sortea. */
    preguntas: FasePoolPregunta[];
    /** Origen por filtros: categoría (null = cualquiera). */
    categoriaId?: number | null;
    categoriaNombre?: string | null;
    /** Origen por filtros: dificultad (null = cualquiera). */
    dificultad?: Dificultad | null;
}

export type UpdateQuizRequest = CreateQuizRequest;

export interface QuizVersion {
    numero: number | null;
    estado: 'Publicada' | 'Borrador' | 'Archivada';
    nombre: string;
    fecha: string;
}

export interface BancoRespuesta {
    texto: string;
    esCorrecta: boolean;
}

/** Pregunta guardada en el banco personal (no pertenece a ningún cuestionario). */
export interface BancoPregunta {
    id: number;
    enunciado: string;
    imagenUrl?: string | null;
    /** Dato curioso: en la partida solo lo ve el anfitrión, tras revelarse la respuesta. */
    curiosidad?: string | null;
    respuestas: BancoRespuesta[];
    dificultad?: Dificultad | null;
    categoriaId?: number | null;
    categoriaNombre?: string | null;
    fechaCreacion: string;
    fechaActualizacion: string;
}

/** Para la categoría se indica `categoriaId` (existente) o `categoriaNombre` (se crea si no existe). */
export interface BancoPreguntaRequest {
    enunciado: string;
    imagenUrl?: string | null;
    curiosidad?: string | null;
    respuestas: BancoRespuesta[];
    dificultad?: Dificultad | null;
    categoriaId?: number | null;
    categoriaNombre?: string | null;
}

export interface BancoPreguntaLista {
    preguntas: BancoPregunta[];
    totalCount: number;
}

export interface BancoFiltros {
    q?: string;
    categoriaId?: number | null;
    sinCategoria?: boolean;
    dificultad?: Dificultad | null;
    page?: number;
    pageSize?: number;
}

/** Categoría del banco con el número de preguntas que contiene. */
export interface BancoCategoria {
    id: number;
    nombre: string;
    total: number;
}

export interface BancoCategorias {
    categorias: BancoCategoria[];
    /** Preguntas del banco que no tienen categoría. */
    sinCategoria: number;
}
