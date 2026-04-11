import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: string;
}

export interface AuthResponse {
    token: string;
    user: AuthUser;
}

export interface SignUpPayload {
    username: string;
    email: string;
    password: string;
}

export interface SignInPayload {
    username: string;
    password: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly API_URL = 'http://localhost:5164/auth';

    constructor(private http: HttpClient) { }

    signUp(payload: SignUpPayload): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.API_URL}/signup`, payload).pipe(
            tap(response => this.saveSession(response))
        );
    }

    signIn(payload: SignInPayload): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.API_URL}/signin`, payload).pipe(
            tap(response => this.saveSession(response))
        );
    }

    saveSession(response: AuthResponse): void {
        console.log('[AuthService] saveSession called with:', response);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        console.log('[AuthService] localStorage set - token:', !!response.token, 'user:', response.user);
        console.log('[AuthService] localStorage.getItem("user"):', localStorage.getItem('user'));
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    getUser(): AuthUser | null {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    logout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}
