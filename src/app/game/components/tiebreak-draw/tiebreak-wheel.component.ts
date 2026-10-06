import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { AudioService } from '../../../shared/services/audio.service';
import { prefersReducedMotion } from '../../utils/count-up';

/** Lo que dura cada giro de la ruleta de nombres y la pausa mostrando el elegido. */
export const WHEEL_SPIN_MS = 3200;
export const WHEEL_PAUSE_MS = 1100;

const COLORES = ['#8b2cff', '#ff2c8b', '#1d2bff', '#16a34a', '#f59e0b', '#0ea5e9', '#ef4444', '#a3e635'];

/**
 * Ruleta de nombres para desempatar a 3 o más: gira y se para en el siguiente puesto (orden decidido por el
 * servidor); ese nombre sale de la rueda y vuelve a girar, hasta repartir los puestos del podio en juego.
 */
@Component({
    selector: 'app-tiebreak-wheel',
    standalone: true,
    template: `
        <div class="wheel-wrap">
            <span class="wheel-pointer" aria-hidden="true"></span>
            <div class="wheel" [style.background]="gradient()" [style.transform]="'rotate(' + rotation() + 'deg)'"
                 [class.spinning]="spinning()">
                @for (n of remaining(); track n; let i = $index) {
                    <span class="wheel-label" [style.--angle]="(i + 0.5) * (360 / remaining().length) + 'deg'">{{ n }}</span>
                }
                <span class="wheel-hub"></span>
            </div>
        </div>
        <ol class="wheel-picked" [attr.start]="position()">
            @for (p of picked(); track p) {
                <li><b>{{ position() + $index }}º</b> {{ p }}</li>
            }
        </ol>
    `,
    styles: [`
        :host { display: flex; flex-direction: column; align-items: center; gap: 1rem; font-family: var(--font-game); }
        .wheel-wrap { position: relative; width: min(18rem, 78vw); aspect-ratio: 1; }
        .wheel-wrap::before {
            content: ''; position: absolute; inset: -4px; border-radius: 50%; background: var(--fx-ink); transform: translate(7px, 9px);
        }
        .wheel {
            position: relative; width: 100%; height: 100%; border-radius: 50%; border: 6px solid #f8fafc;
            box-shadow: 0 0 0 4px var(--fx-ink); box-sizing: border-box;
        }
        .wheel.spinning { transition: transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1); }
        .wheel-label {
            position: absolute; top: 50%; left: 50%; max-width: 38%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-weight: 900; font-size: 0.95rem; color: #fff; -webkit-text-stroke: 0.5px var(--fx-ink);
            transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-4.6rem);
        }
        .wheel-hub { position: absolute; top: 50%; left: 50%; width: 14%; height: 14%; border-radius: 50%; background: #f8fafc; border: 3px solid var(--fx-ink); transform: translate(-50%, -50%); }
        .wheel-pointer {
            position: absolute; top: -14px; left: 50%; z-index: 2; margin-left: -15px; width: 0; height: 0;
            border-left: 15px solid transparent; border-right: 15px solid transparent; border-top: 32px solid #f97316;
            filter: drop-shadow(2px 2px 0 var(--fx-ink));
        }
        .wheel-picked { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
        .wheel-picked li {
            padding: 0.35rem 0.9rem; border-radius: 0.6rem; background: #16a34a; color: #fff; font-weight: 900;
            border: 3px solid var(--fx-ink); box-shadow: 3px 3px 0 var(--fx-ink); animation: pick-in 0.45s cubic-bezier(0.2, 1.5, 0.4, 1) both;
        }
        @keyframes pick-in { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `]
})
export class TiebreakWheelComponent implements OnInit, OnDestroy {
    private audio = inject(AudioService);

    /** Nombres en el orden resultante del sorteo (el 1º es quien sale primero). */
    names = input.required<string[]>();
    /** Primer puesto en disputa (para numerar los elegidos). */
    position = input<number>(1);
    /** Cuántos puestos se reparten con la ruleta. */
    picks = input<number>(1);

    picked = signal<string[]>([]);
    rotation = signal(0);
    spinning = signal(false);
    /** Nombres aún en la rueda, en un orden fijo mezclado para que el resultado no se vea venir. */
    private wheelOrder = signal<string[]>([]);
    remaining = computed(() => this.wheelOrder().filter(n => !this.picked().includes(n)));
    gradient = computed(() => {
        const n = this.remaining().length || 1;
        const step = 360 / n;
        return `conic-gradient(${this.remaining().map((_, i) => `${COLORES[i % COLORES.length]} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
    });
    private timers: ReturnType<typeof setTimeout>[] = [];

    ngOnInit(): void {
        const names = this.names();
        // Orden de la rueda: alfabético (no delata el resultado)
        this.wheelOrder.set([...names].sort((a, b) => a.localeCompare(b, 'es')));
        const spins = Math.min(this.picks(), names.length);
        if (prefersReducedMotion()) {
            this.picked.set(names.slice(0, spins));
            return;
        }
        for (let i = 0; i < spins; i++) {
            const start = 300 + i * (WHEEL_SPIN_MS + WHEEL_PAUSE_MS);
            this.timers.push(setTimeout(() => this.spinTo(names[i]), start));
            this.timers.push(setTimeout(() => {
                this.audio.playRuletaStop();
                this.picked.update(p => [...p, names[i]]);
                // La rueda vuelve a cero sin animación para el siguiente giro (ya sin el elegido)
                this.spinning.set(false);
                this.rotation.set(0);
            }, start + WHEEL_SPIN_MS));
        }
    }

    ngOnDestroy(): void {
        this.timers.forEach(clearTimeout);
    }

    /** Gira varias vueltas y se para con el sector de `name` bajo el puntero (arriba). */
    private spinTo(name: string): void {
        const wheel = this.remaining();
        const index = wheel.indexOf(name);
        const step = 360 / wheel.length;
        const jitter = (Math.random() - 0.5) * step * 0.6;
        this.spinning.set(true);
        this.rotation.set(360 * 6 + (360 - (index + 0.5) * step) + jitter);
        // Tics que se van espaciando según se frena
        for (let t = 0, gap = 60; t < WHEEL_SPIN_MS - 200; t += gap, gap *= 1.12) {
            this.timers.push(setTimeout(() => this.audio.playRuletaTick(), t));
        }
    }
}
