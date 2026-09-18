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
    }[];
}

export type UpdateQuizRequest = CreateQuizRequest;

export interface QuizVersion {
    numero: number | null;
    estado: 'Publicada' | 'Borrador' | 'Archivada';
    nombre: string;
    fecha: string;
}
