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
    dificultad?: Dificultad | null;
    imagenUrl?: string | null;
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
        dificultad?: Dificultad;
    }[];
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
