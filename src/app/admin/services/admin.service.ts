import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserResponse, UpdateUserRequest } from '../models/admin.models';
import { AuthService } from '../../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private readonly API_URL = 'http://localhost:5164/users';

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getAuthHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    getUsers(): Observable<UserResponse[]> {
        return this.http.get<UserResponse[]>(`${this.API_URL}`, {
            headers: this.getAuthHeaders()
        });
    }

    updateUser(id: number, data: UpdateUserRequest): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.API_URL}/${id}`, data, {
            headers: this.getAuthHeaders()
        });
    }

    banUser(id: number): Observable<void> {
        return this.http.post<void>(`${this.API_URL}/${id}/ban`, {}, {
            headers: this.getAuthHeaders()
        });
    }

    activateUser(id: number): Observable<void> {
        return this.http.post<void>(`${this.API_URL}/${id}/activate`, {}, {
            headers: this.getAuthHeaders()
        });
    }
}
