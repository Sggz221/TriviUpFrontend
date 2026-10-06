import { Component, computed, input } from '@angular/core';
import { PenaltyState } from '../../models/game.models';

/** Casilla del marcador de penaltis: gol, parada o pendiente. */
type Casilla = 'gol' | 'parada' | 'pendiente';

interface Fila {
    id: number;
    nombre: string;
    goles: number;
    casillas: Casilla[];
    tirando: boolean;
    eliminado: boolean;
    ganador: boolean;
}

/**
 * Marcador de la tanda de penaltis: una fila por tirador con sus 5 tiros (y los de la muerte súbita).
 * El tirador actual va resaltado y los que ya no pueden ganar, tachados.
 */
@Component({
    selector: 'app-penalty-board',
    standalone: true,
    template: `
        <section class="pb" aria-label="Marcador de penaltis">
            <header class="pb-head">
                <span class="pb-title">⚽ Penaltis</span>
                <span class="pb-round">{{ state().suddenDeath ? '¡Muerte súbita!' : 'Ronda ' + Math.min(state().round, state().regulationKicks) + ' de ' + state().regulationKicks }}</span>
            </header>
            @for (f of filas(); track f.id) {
                <div class="pb-row" [class.kicking]="f.tirando" [class.out]="f.eliminado" [class.winner]="f.ganador">
                    <span class="pb-name" [title]="f.nombre">{{ f.nombre }}</span>
                    <span class="pb-kicks">
                        @for (c of f.casillas; track $index) {
                            <span class="pb-kick" [class]="c" [class.sd]="$index >= state().regulationKicks"
                                  [attr.aria-label]="c === 'gol' ? 'Gol' : c === 'parada' ? 'Parada' : 'Pendiente'">
                                {{ c === 'gol' ? '⚽' : c === 'parada' ? '✖' : '' }}
                            </span>
                        }
                    </span>
                    <span class="pb-goals">{{ f.goles }}</span>
                </div>
            }
        </section>
    `,
    styles: [`
        :host { display: block; width: 100%; }
        .pb {
            width: 100%; box-sizing: border-box; padding: 0.75rem 0.9rem; border-radius: 1rem;
            background: linear-gradient(180deg, #14532d, #0f3d22); color: #fff; font-family: var(--font-game);
            border: 3px solid var(--fx-ink); box-shadow: 5px 5px 0 var(--fx-ink);
            background-image: repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 40px, transparent 40px 80px),
                              linear-gradient(180deg, #166534, #0f3d22);
        }
        .pb-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem; }
        .pb-title { font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; }
        .pb-round { font-weight: 800; font-size: 0.9rem; color: #fde047; }
        .pb-row {
            display: grid; grid-template-columns: minmax(0, 1fr) auto 2rem; align-items: center; gap: 0.6rem;
            padding: 0.35rem 0.5rem; border-radius: 0.6rem; transition: background-color 0.3s ease;
        }
        .pb-row.kicking { background: rgb(255 255 255 / 0.14); box-shadow: inset 0 0 0 2px #fde047; }
        .pb-row.out .pb-name { text-decoration: line-through; opacity: 0.55; }
        .pb-row.winner { background: rgb(253 224 71 / 0.25); }
        .pb-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pb-kicks { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: flex-end; }
        .pb-kick {
            width: 1.6rem; height: 1.6rem; display: grid; place-items: center; border-radius: 50%;
            border: 2px solid var(--fx-ink); background: rgb(255 255 255 / 0.15); font-size: 0.9rem; font-weight: 900;
        }
        .pb-kick.gol { background: #22c55e; animation: kick-pop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
        .pb-kick.parada { background: #ef4444; animation: kick-pop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
        .pb-kick.sd { border-style: dashed; }
        .pb-goals { font-family: var(--font-display); font-size: 1.3rem; text-align: right; color: #fde047; }
        @keyframes kick-pop { from { transform: scale(0.2); } to { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .pb-kick { animation: none !important; } }
        @media (max-width: 420px) { .pb-kick { width: 1.3rem; height: 1.3rem; font-size: 0.75rem; } }
    `]
})
export class PenaltyBoardComponent {
    state = input.required<PenaltyState>();
    protected readonly Math = Math;

    filas = computed<Fila[]>(() => {
        const s = this.state();
        // Casillas: las 5 reglamentarias y, en muerte súbita, una más por ronda jugada
        const maxTiros = Math.max(s.regulationKicks, ...s.playerIds.map(id => s.kicks.filter(k => k.playerId === id).length));
        const huecos = s.suddenDeath ? Math.max(maxTiros, s.round) : s.regulationKicks;
        return s.playerIds.map((id, i) => {
            const tiros = s.kicks.filter(k => k.playerId === id);
            return {
                id,
                nombre: s.usernames[i] ?? 'jugador',
                goles: tiros.filter(k => k.scored).length,
                casillas: Array.from({ length: huecos }, (_, n) =>
                    n < tiros.length ? (tiros[n].scored ? 'gol' : 'parada') : 'pendiente') as Casilla[],
                tirando: !s.finished && s.kickerId === id,
                eliminado: s.eliminated.includes(id),
                ganador: s.finished && s.winnerId === id
            };
        });
    });
}
