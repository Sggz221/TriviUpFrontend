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
    etiquetas: string[];
    fechaCreacion: string;
    fechaActualizacion: string;
}

export interface BancoPreguntaRequest {
    enunciado: string;
    imagenUrl?: string | null;
    respuestas: BancoRespuesta[];
    etiquetas: string[];
}

export interface BancoPreguntaLista {
    preguntas: BancoPregunta[];
    totalCount: number;
}

export interface EtiquetaCount {
    etiqueta: string;
    total: number;
}
