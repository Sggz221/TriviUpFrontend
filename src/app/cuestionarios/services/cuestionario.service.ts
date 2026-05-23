import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cuestionario, CreateQuizRequest } from '../models/cuestionario.model';
import { AuthService } from '../../auth/auth.service';

export interface UploadQuestionImageResponse {
    imagenUrl: string;
}

export interface UploadQuizImageResponse {
    path: string;
    url: string;
}

@Injectable({
    providedIn: 'root'
})
export class CuestionarioService {
    private readonly API_URL = '/api/cuestionarios';
    private readonly PREGUNTAS_API_URL = '/cuestionarios/preguntas';

    private http = inject(HttpClient);
    private authService = inject(AuthService);

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

    subirImagenPregunta(file: File): Observable<UploadQuizImageResponse> {
        console.log('[CuestionarioService] subirImagenPregunta - file:', file.name);

        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<UploadQuizImageResponse>(
            `${this.API_URL}/imagenes`,
            formData,
            {
                headers: this.getHeaders()
            }
        );
    }

    actualizarImagenPregunta(preguntaId: number, file: File): Observable<UploadQuestionImageResponse> {
        console.log('[CuestionarioService] actualizarImagenPregunta - preguntaId:', preguntaId, 'file:', file.name);

        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<UploadQuestionImageResponse>(
            `${this.PREGUNTAS_API_URL}/${preguntaId}/imagen`,
            formData,
            {
                headers: this.getHeaders()
            }
        );
    }

    eliminarImagenPregunta(preguntaId: number): Observable<void> {
        console.log('[CuestionarioService] eliminarImagenPregunta - preguntaId:', preguntaId);

        return this.http.delete<void>(
            `${this.PREGUNTAS_API_URL}/${preguntaId}/imagen`,
            {
                headers: this.getHeaders()
            }
        );
    }
}
