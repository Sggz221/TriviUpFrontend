import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BancoCategoria, BancoCategorias } from '../models/cuestionario.model';
import { AuthService } from '../../auth/auth.service';
import { getApiBaseUrl } from '../../shared/utils/api-url.utils';

@Injectable({
    providedIn: 'root'
})
export class BancoCategoriasService {
    private readonly API_URL = `${getApiBaseUrl()}/api/banco-categorias`;

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` });
    }

    listar(): Observable<BancoCategorias> {
        return this.http.get<BancoCategorias>(this.API_URL, { headers: this.getHeaders() });
    }

    crear(nombre: string): Observable<BancoCategoria> {
        return this.http.post<BancoCategoria>(this.API_URL, { nombre }, { headers: this.getHeaders() });
    }

    renombrar(id: number, nombre: string): Observable<BancoCategoria> {
        return this.http.put<BancoCategoria>(`${this.API_URL}/${id}`, { nombre }, { headers: this.getHeaders() });
    }

    /** Borra la categoría; sus preguntas se conservan sin categoría. */
    eliminar(id: number): Observable<void> {
        return this.http.delete<void>(`${this.API_URL}/${id}`, { headers: this.getHeaders() });
    }
}
