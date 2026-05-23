import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CuestionarioPublico, PaginatedQuizzesResponse } from '../models/cuestionario-publico.model';

@Injectable({
    providedIn: 'root'
})
export class QuizzesPublicService {
    private readonly API_URL = '/api/quizzes';

    private http = inject(HttpClient);

    getQuizzesPublic(
        search?: string,
        page: number = 1,
        pageSize: number = 20
    ): Observable<PaginatedQuizzesResponse> {
        const params: Record<string, string> = {
            page: page.toString(),
            pageSize: pageSize.toString()
        };

        if (search && search.trim()) {
            params['search'] = search.trim();
        }

        return this.http.get<PaginatedQuizzesResponse>(
            `${this.API_URL}/public`,
            { params }
        );
    }

    likeQuiz(id: number): Observable<{ count: number }> {
        return this.http.post<{ count: number }>(
            `${this.API_URL}/${id}/like`,
            {}
        );
    }

    unlikeQuiz(id: number): Observable<{ count: number }> {
        return this.http.delete<{ count: number }>(
            `${this.API_URL}/${id}/like`
        );
    }

    recordVisit(id: number): Observable<{ count: number }> {
        return this.http.post<{ count: number }>(
            `${this.API_URL}/${id}/visit`,
            {}
        );
    }
}
