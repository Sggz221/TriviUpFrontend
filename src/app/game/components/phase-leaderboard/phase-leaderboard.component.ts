import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { Player } from '../../models/game.models';

/** Fila del marcador con su posición y puntuación antes y después de la fase. */
interface Fila {
    userId: number;
    username: string;
    scorePrevio: number;
    scoreNuevo: number;
    /** Puesto (0 = primero) antes y después; los empates comparten puesto. */
    posPrevia: number;
    posNueva: number;
}

const ALTO_FILA_PX = 60;
const PAUSA_INICIAL_MS = 700;
const DURACION_CONTEO_MS = 1100;

/**
 * Marcador de intermedio entre fases: lista vertical en la que, tras una breve pausa, cada jugador sube o
 * baja hasta su nuevo puesto mientras su puntuación cuenta hacia arriba (estilo Kahoot). Es deliberadamente
 * más sobrio que el podio final. Sin `previous` se muestra directamente el resultado, sin animación.
 */
@Component({
    selector: 'app-phase-leaderboard',
    standalone: true,
    template: `
        <ol class="lb" [style.height.px]="filas().length * altoFila" [attr.aria-label]="'Clasificación'">
            @for (f of filas(); track f.userId) {
                <li class="lb-fila"
                    [class.lb-yo]="f.userId === myUserId()"
                    [class.lb-primero]="posicion(f) === 0"
                    [class.lb-moviendo]="animando() && f.posPrevia !== f.posNueva"
                    [style.transform]="'translateY(' + posicion(f) * altoFila + 'px)'"
                    [style.--acento]="color()">
                    <span class="lb-puesto">{{ posicion(f) + 1 }}</span>
                    <span class="lb-nombre" [title]="f.username">{{ f.username }}</span>
                    <span class="lb-cambio" aria-hidden="true">
                        @if (terminado()) {
                            @if (f.posPrevia - f.posNueva > 0) {
                                <span class="sube">▲ {{ f.posPrevia - f.posNueva }}</span>
                            } @else if (f.posPrevia - f.posNueva < 0) {
                                <span class="baja">▼ {{ f.posNueva - f.posPrevia }}</span>
                            }
                        }
                    </span>
                    <span class="lb-ganados">
                        @if (terminado() && f.scoreNuevo - f.scorePrevio > 0) {
                            +{{ f.scoreNuevo - f.scorePrevio }}
                        }
                    </span>
                    <span class="lb-puntos">{{ puntos(f) }}</span>
                </li>
            }
        </ol>
    `,
    styles: [`
        .lb { position: relative; list-style: none; margin: 0; padding: 0; width: 100%; }
        .lb-fila {
            position: absolute; left: 0; right: 0; top: 0; height: 52px;
            display: grid; grid-template-columns: 2.25rem 1fr auto auto auto; align-items: center; gap: 0.6rem;
            padding: 0 0.9rem; border-radius: 0.75rem; box-sizing: border-box;
            background: var(--base-200); border-left: 5px solid transparent;
            transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.4s ease, border-color 0.4s ease;
        }
        .lb-primero { border-left-color: var(--acento); }
        .lb-yo { background: color-mix(in srgb, var(--acento) 22%, var(--base-200)); }
        .lb-moviendo { z-index: 2; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35); }
        .lb-puesto {
            width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: 50%;
            font-weight: 800; background: color-mix(in srgb, var(--acento) 30%, transparent);
        }
        .lb-nombre { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-cambio { min-width: 2.75rem; text-align: right; font-size: 0.85rem; font-weight: 700; }
        .sube { color: var(--success); animation: aparece 0.4s ease both; }
        .baja { color: var(--error); animation: aparece 0.4s ease both; }
        .lb-ganados { min-width: 3.25rem; text-align: right; font-size: 0.85rem; color: var(--success); font-weight: 700; animation: aparece 0.4s ease both; }
        .lb-puntos { min-width: 3.5rem; text-align: right; font-weight: 800; font-size: 1.15rem; font-variant-numeric: tabular-nums; }
        @keyframes aparece { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 420px) {
            .lb-fila { grid-template-columns: 2rem 1fr auto auto; gap: 0.4rem; padding: 0 0.6rem; }
            .lb-cambio { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
            .lb-fila { transition: none; }
            .sube, .baja, .lb-ganados { animation: none; }
        }
    `]
})
export class PhaseLeaderboardComponent implements OnInit {
    private destroyRef = inject(DestroyRef);

    /** Clasificación actual (se ignora al anfitrión, que no puntúa). */
    players = input<Player[]>([]);
    /** Clasificación en el intermedio anterior; null = sin animación. */
    previous = input<Player[] | null>(null);
    /** Color de acento (el de la fase). */
    color = input('#3b82f6');
    myUserId = input<number | null>(null);

    readonly altoFila = ALTO_FILA_PX;

    /** true cuando las filas ya están en su puesto nuevo. */
    animando = signal(false);
    /** 0..1: avance del conteo de puntos. */
    private progreso = signal(0);
    terminado = computed(() => this.progreso() >= 1);

    filas = computed<Fila[]>(() => {
        const actuales = this.players().filter(p => !p.isOwner && !p.isSpectator);
        const previos = this.previous();
        const previoPor = new Map((previos ?? []).map(p => [p.userId, p]));

        const base = actuales.map((p, orden) => ({
            userId: p.userId,
            username: p.username,
            orden,
            scoreNuevo: p.score,
            scorePrevio: previos ? (previoPor.get(p.userId)?.score ?? 0) : p.score
        }));

        // Puesto = 1 + jugadores con más puntos; a igualdad de puntos manda el orden de llegada
        const puesto = (clave: 'scoreNuevo' | 'scorePrevio') => {
            const ordenados = [...base].sort((a, b) => b[clave] - a[clave] || a.orden - b.orden);
            return new Map(ordenados.map((f, i) => [f.userId, i]));
        };
        const posPrevia = puesto('scorePrevio');
        const posNueva = puesto('scoreNuevo');

        return base.map(f => ({
            userId: f.userId,
            username: f.username,
            scorePrevio: f.scorePrevio,
            scoreNuevo: f.scoreNuevo,
            posPrevia: posPrevia.get(f.userId)!,
            posNueva: posNueva.get(f.userId)!
        }));
    });

    ngOnInit(): void {
        if (!this.previous()) {
            this.animando.set(true);
            this.progreso.set(1);
            return;
        }

        const reducirMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducirMovimiento) {
            this.animando.set(true);
            this.progreso.set(1);
            return;
        }

        // Conteo basado en el tiempo transcurrido con un intervalo (no con requestAnimationFrame): en una
        // pestaña en segundo plano rAF se pausa y el marcador se quedaría a medias; así llega al valor final.
        let intervalo: ReturnType<typeof setInterval> | null = null;
        const arranque = setTimeout(() => {
            this.animando.set(true);
            const inicio = performance.now();
            intervalo = setInterval(() => {
                const t = Math.min((performance.now() - inicio) / DURACION_CONTEO_MS, 1);
                this.progreso.set(1 - Math.pow(1 - t, 3));
                if (t >= 1 && intervalo) {
                    clearInterval(intervalo);
                    intervalo = null;
                }
            }, 30);
        }, PAUSA_INICIAL_MS);

        this.destroyRef.onDestroy(() => {
            clearTimeout(arranque);
            if (intervalo) clearInterval(intervalo);
        });
    }

    posicion(f: Fila): number {
        return this.animando() ? f.posNueva : f.posPrevia;
    }

    puntos(f: Fila): number {
        return Math.round(f.scorePrevio + (f.scoreNuevo - f.scorePrevio) * this.progreso());
    }
}
