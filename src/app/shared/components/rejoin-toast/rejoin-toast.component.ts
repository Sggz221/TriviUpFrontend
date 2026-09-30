import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import { clearLastGame, getLastGame, LastGame } from '../../../game/utils/last-game.utils';

/**
 * Aviso flotante "Partida en curso · Reconectar" que aparece en cualquier página
 * fuera de la sala mientras haya una última partida vigente (last-game.utils).
 * Reconectar solo navega a /game/:code: la sala se encarga de volver a unirse.
 */
@Component({
    selector: 'app-rejoin-toast',
    standalone: true,
    imports: [IconComponent],
    templateUrl: './rejoin-toast.html',
    styleUrls: ['./rejoin-toast.scss']
})
export class RejoinToastComponent {
    private router = inject(Router);

    lastGame = signal<LastGame | null>(null);
    private currentUrl = signal<string>(this.router.url);

    visible = computed(() => {
        const game = this.lastGame();
        if (!game) return false;
        // Dentro de esa misma sala no tiene sentido ofrecer volver
        const path = this.currentUrl().split(/[?#]/)[0].toLowerCase();
        return path !== `/game/${game.roomCode.toLowerCase()}`;
    });

    minutesAgo = computed(() => {
        const game = this.lastGame();
        return game ? Math.max(0, Math.floor((Date.now() - game.savedAt) / 60000)) : 0;
    });

    constructor() {
        this.refresh();
        this.router.events
            .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
            .subscribe(e => {
                this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
                this.refresh();
            });
    }

    private refresh(): void {
        this.lastGame.set(getLastGame());
    }

    reconnect(): void {
        const game = getLastGame();
        if (!game) {
            this.lastGame.set(null);
            return;
        }
        this.router.navigate(['/game', game.roomCode]);
    }

    dismiss(): void {
        clearLastGame();
        this.lastGame.set(null);
    }
}
