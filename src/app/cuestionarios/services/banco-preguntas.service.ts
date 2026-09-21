import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BancoPregunta, BancoPreguntaLista, BancoPreguntaRequest, EtiquetaCount } from '../models/cuestionario.model';
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

    listar(filtros: { q?: string; etiqueta?: string; page?: number; pageSize?: number } = {}): Observable<BancoPreguntaLista> {
        let params = new HttpParams();
        if (filtros.q) params = params.set('q', filtros.q);
        if (filtros.etiqueta) params = params.set('etiqueta', filtros.etiqueta);
        params = params.set('page', filtros.page ?? 1).set('pageSize', filtros.pageSize ?? 20);
        return this.http.get<BancoPreguntaLista>(this.API_URL, { headers: this.getHeaders(), params });
    }

    obtenerEtiquetas(): Observable<EtiquetaCount[]> {
        return this.http.get<EtiquetaCount[]>(`${this.API_URL}/etiquetas`, { headers: this.getHeaders() });
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
}
