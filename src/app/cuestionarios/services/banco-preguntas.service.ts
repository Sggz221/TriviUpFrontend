import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BancoFiltros, BancoPregunta, BancoPreguntaLista, BancoPreguntaRequest } from '../models/cuestionario.model';
import { AuthService } from '../../auth/auth.service';
import { getApiBaseUrl } from '../../shared/utils/api-url.utils';

@Injectable({
    providedIn: 'root'
})
export class BancoPreguntasService {
    private readonly API_URL = `${getApiBaseUrl()}/api/banco-preguntas`;

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` });
    }

    listar(filtros: BancoFiltros = {}): Observable<BancoPreguntaLista> {
        let params = new HttpParams();
        if (filtros.q) params = params.set('q', filtros.q);
        if (filtros.sinCategoria) {
            params = params.set('sinCategoria', true);
        } else if (filtros.categoriaId) {
            params = params.set('categoriaId', filtros.categoriaId);
        }
        if (filtros.dificultad) params = params.set('dificultad', filtros.dificultad);
        params = params.set('page', filtros.page ?? 1).set('pageSize', filtros.pageSize ?? 20);
        return this.http.get<BancoPreguntaLista>(this.API_URL, { headers: this.getHeaders(), params });
    }

    crear(request: BancoPreguntaRequest): Observable<BancoPregunta> {
        return this.http.post<BancoPregunta>(this.API_URL, request, { headers: this.getHeaders() });
    }

    actualizar(id: number, request: BancoPreguntaRequest): Observable<BancoPregunta> {
        return this.http.put<BancoPregunta>(`${this.API_URL}/${id}`, request, { headers: this.getHeaders() });
    }

    eliminar(id: number): Observable<void> {
        return this.http.delete<void>(`${this.API_URL}/${id}`, { headers: this.getHeaders() });
    }

    /** Mueve varias preguntas a una categoría (o las deja sin categoría si `categoriaId` es null). */
    asignarCategoria(preguntaIds: number[], categoriaId: number | null): Observable<{ actualizadas: number }> {
        return this.http.post<{ actualizadas: number }>(
            `${this.API_URL}/asignar-categoria`,
            { preguntaIds, categoriaId },
            { headers: this.getHeaders() });
    }
}
