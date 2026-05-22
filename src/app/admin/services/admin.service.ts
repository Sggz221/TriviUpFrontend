import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserResponse, UpdateUserRequest, AdminStats } from '../models/admin.models';
import { AuthService } from '../../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private readonly API_URL = 'http://localhost:5164';
    private readonly USERS_URL = `${this.API_URL}/users`;
    private readonly ADMIN_URL = `${this.API_URL}/api/admin`;

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getAuthHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    getUsers(): Observable<UserResponse[]> {
        return this.http.get<UserResponse[]>(`${this.USERS_URL}`, {
            headers: this.getAuthHeaders()
        });
    }

    updateUser(id: number, data: UpdateUserRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.USERS_URL}/${id}`, data, {
            headers: this.getAuthHeaders()
        });
    }

    banUser(id: number): Observable<void> {
        return this.http.post<void>(`${this.USERS_URL}/${id}/ban`, {}, {
            headers: this.getAuthHeaders()
        });
    }

    activateUser(id: number): Observable<void> {
        return this.http.post<void>(`${this.USERS_URL}/${id}/activate`, {}, {
            headers: this.getAuthHeaders()
        });
    }

    getStats(): Observable<AdminStats> {
        return this.http.get<AdminStats>(`${this.ADMIN_URL}/stats`, {
            headers: this.getAuthHeaders()
        });
    }
}
