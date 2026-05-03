import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cuestionario, CreateQuizRequest } from '../models/cuestionario.model';
import { AuthService } from '../../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class CuestionarioService {
    private readonly API_URL = 'http://localhost:5164/api/cuestionarios';

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    private getHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        console.log('[CuestionarioService] getHeaders - token exists:', !!token);
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    crearQuiz(request: CreateQuizRequest): Observable<Cuestionario> {
        return this.http.post<Cuestionario>(this.API_URL, request, {
            headers: this.getHeaders()
        });
    }

    obtenerMisQuizzes(): Observable<Cuestionario[]> {
        return this.http.get<Cuestionario[]>(`${this.API_URL}/mis-cuestionarios`, {
            headers: this.getHeaders()
        });
    }

    obtenerQuiz(id: number): Observable<Cuestionario> {
        return this.http.get<Cuestionario>(`${this.API_URL}/${id}`, {
            headers: this.getHeaders()
        });
    }

    obtenerPorGameCode(gameCode: string): Observable<Cuestionario> {
        return this.http.get<Cuestionario>(`${this.API_URL}/gamecode/${gameCode}`, {
            headers: this.getHeaders()
        });
    }

    eliminarQuiz(id: number): Observable<void> {
        return this.http.delete<void>(`${this.API_URL}/${id}`, {
            headers: this.getHeaders()
        });
    }
}
