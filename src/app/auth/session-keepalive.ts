import { Injectable, NgZone, inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Mantiene viva la sesión mientras la persona usa la app (formulario largo de
 * cuestionario, partida...). Registra actividad (clic, tecla, toque) y, si hay
 * actividad reciente y el token caduca pronto, pide uno nuevo al backend.
 */
@Injectable({ providedIn: 'root' })
export class SessionKeepAlive {
    private authService = inject(AuthService);
    private zone = inject(NgZone);

    private static readonly CHECK_MS = 60 * 1000;
    private static readonly RENEW_WHEN_LEFT_MS = 15 * 60 * 1000;
    private static readonly ACTIVE_WINDOW_MS = 10 * 60 * 1000;

    private lastActivity = Date.now();
    private refreshing = false;
    private started = false;

    start(): void {
        if (this.started) return;
        this.started = true;

        this.zone.runOutsideAngular(() => {
            const mark = () => { this.lastActivity = Date.now(); };
            for (const evt of ['click', 'keydown', 'pointerdown', 'touchstart', 'input']) {
                window.addEventListener(evt, mark, { passive: true });
            }
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) this.check();
            });
            setInterval(() => this.check(), SessionKeepAlive.CHECK_MS);
        });
    }

    private check(): void {
        if (this.refreshing) return;
        const left = this.authService.msUntilExpiry();
        if (left === null || left <= 0) return;

        const recentlyActive = Date.now() - this.lastActivity < SessionKeepAlive.ACTIVE_WINDOW_MS;
        // Una partida abierta cuenta como actividad aunque no se toque nada
        const inGame = window.location.pathname.startsWith('/game/');
        if (!(recentlyActive || inGame) || left > SessionKeepAlive.RENEW_WHEN_LEFT_MS) return;

        this.refreshing = true;
        this.authService.refreshToken().subscribe({
            next: () => { this.refreshing = false; },
            error: () => { this.refreshing = false; }
        });
    }
}
