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
}

export interface Cuestionario {
    id: number;
    nombre: string;
    gameCode: string;
    preguntas: Pregunta[];
    creatorId: number;
    fechaCreacion: string;
    fechaActualizacion: string;
}

export interface CreateQuizRequest {
    nombre: string;
    preguntas: {
        numeroPregunta: number;
        enunciado: string;
        respuestas: { texto: string; esCorrecta: boolean }[];
    }[];
}
