export interface CuestionarioPublico {
    id: number;
    titulo: string;
    descripcion: string;
    creadorUsername: string;
    visitas: number;
    likes: number;
    preguntasCount: number;
    fechaCreacion: string;
    userHasLiked: boolean;
}

export interface PaginatedQuizzesResponse {
    quizzes: CuestionarioPublico[];
    totalCount: number;
    page: number;
    pageSize: number;
}
