export interface UserResponse {
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: string;
    isBanned: boolean;
}

export interface UpdateUserRequest {
    username?: string;
    email?: string;
    role?: string;
}

export interface AdminStats {
    totalGamesPlayed: number;
    totalQuizzes: number;
    totalUsers: number;
    activeUsersLast24h: number;
    mostFavoritesQuiz: QuizStat | null;
    mostVisitsQuiz: QuizStat | null;
    gamesPerDay: DailyStat[];
    activeUsersPerDay: DailyStat[];
}

export interface QuizStat {
    id: number;
    nombre: string;
    favorites?: number;
    visitas?: number;
}

export interface DailyStat {
    date: string;
    count: number;
}
