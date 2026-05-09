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
