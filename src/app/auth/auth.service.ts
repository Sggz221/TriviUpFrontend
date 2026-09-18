import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { getApiBaseUrl } from '../shared/utils/api-url.utils';

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: string;
    profilePhotoUrl: string | null;
}

export interface AuthResponse {
    token: string;
    user: AuthUser;
}

export interface SignInPayload {
    username: string;
    password: string;
}

export interface SignUpPayload {
    username: string;
    email: string;
    password: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly API_URL = `${getApiBaseUrl()}/auth`;

    constructor(private http: HttpClient) { }

    signIn(payload: SignInPayload): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.API_URL}/signin`, payload).pipe(
            tap(response => this.saveSession(response))
        );
    }

    signUp(payload: SignUpPayload): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.API_URL}/signup`, payload).pipe(
            tap(response => this.saveSession(response))
        );
    }

    /** Pide un token nuevo al backend (renueva la sesión sin volver a pedir credenciales). */
    refreshToken(): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, {}).pipe(
            tap(response => this.saveSession(response))
        );
    }

    /** Milisegundos hasta que caduca el token actual (null si no hay token válido). */
    msUntilExpiry(): number | null {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const expiresAt = this.getTokenExpiration(token);
        return expiresAt === null ? null : expiresAt - Date.now();
    }

    saveSession(response: AuthResponse): void {
        console.log('[AuthService] saveSession called with:', response);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        console.log('[AuthService] localStorage set - token:', !!response.token, 'user:', response.user);
        console.log('[AuthService] localStorage.getItem("user"):', localStorage.getItem('user'));
    }

    getToken(): string | null {
        const token = localStorage.getItem('token');
        console.log('[AuthService] getToken called, token exists:', !!token);
        return token;
    }

    getUser(): AuthUser | null {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    isLoggedIn(): boolean {
        const token = this.getToken();
        if (!token) return false;

        const expiresAt = this.getTokenExpiration(token);
        if (expiresAt === null || expiresAt <= Date.now()) {
            this.logout();
            return false;
        }

        return true;
    }

    private getTokenExpiration(token: string): number | null {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
        } catch {
            return null;
        }
    }

    logout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    updateStoredUser(updatedUser: AuthUser): void {
        localStorage.setItem('user', JSON.stringify(updatedUser));
    }

    getUserSignal() {
        return signal(this.getUser());
    }
}
