import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const token = authService.getToken();
    const authReq = token && !req.headers.has('Authorization')
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            // Solo forzamos logout si había una sesión activa: un 401 en signin/signup
            // (sin token previo) es simplemente "credenciales inválidas", no expiración.
            if (error.status === 401 && token) {
                authService.logout();
                router.navigate(['/auth']);
            }
            return throwError(() => error);
        })
    );
};
