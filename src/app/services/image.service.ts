import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export interface UploadQuestionImageResponse {
    imagenUrl: string;
}

@Injectable({
    providedIn: 'root'
})
export class ImageService {
    private readonly API_URL = '/cuestionarios/preguntas';

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getAuthHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    uploadQuestionImage(questionId: number, file: File): Observable<UploadQuestionImageResponse> {
        console.log('[ImageService] uploadQuestionImage - questionId:', questionId, 'file:', file.name, file.type, file.size);

        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<UploadQuestionImageResponse>(
            `${this.API_URL}/${questionId}/imagen`,
            formData,
            {
                headers: this.getAuthHeaders()
            }
        ).pipe(
            tap(response => {
                console.log('[ImageService] Upload exitoso, response:', response);
            }),
            catchError(error => {
                console.error('[ImageService] Error uploading question image:', error);
                return throwError(() => error);
            })
        );
    }

    deleteQuestionImage(questionId: number): Observable<void> {
        console.log('[ImageService] deleteQuestionImage - questionId:', questionId);

        return this.http.delete<void>(
            `${this.API_URL}/${questionId}/imagen`,
            {
                headers: this.getAuthHeaders()
            }
        ).pipe(
            tap(() => {
                console.log('[ImageService] Delete exitoso');
            }),
            catchError(error => {
                console.error('[ImageService] Error deleting question image:', error);
                return throwError(() => error);
            })
        );
    }
}
