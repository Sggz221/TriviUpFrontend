import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { AudioService } from '../../../shared/services/audio.service';
import { prefersReducedMotion } from '../../utils/count-up';

/** Lo que tarda la moneda en el aire hasta caer. */
export const COIN_FLIP_MS = 3600;

/**
 * Moneda al aire para desempatar a 2 jugadores: un nombre en cada cara, sube girando, se frena y cae en el
 * ganador que ya decidió el servidor (`winner`: 0 = primer nombre, 1 = segundo).
 */
@Component({
    selector: 'app-tiebreak-coin',
    standalone: true,
    template: `
        <div class="coin-stage">
            <div class="coin" [class.flipping]="flipping()" [style.--final]="finalRotation()">
                <div class="coin-face front"><span>{{ names()[0] }}</span></div>
                <div class="coin-face back"><span>{{ names()[1] }}</span></div>
            </div>
            <div class="coin-shadow" [class.flipping]="flipping()"></div>
        </div>
        <p class="coin-result" [class.visible]="landed()">¡{{ names()[winner()] }} gana el sorteo!</p>
    `,
    styles: [`
        :host { display: flex; flex-direction: column; align-items: center; gap: 1rem; font-family: var(--font-game); }
        .coin-stage { position: relative; width: 10rem; height: 15rem; perspective: 800px; display: flex; align-items: flex-end; justify-content: center; }
        .coin {
            position: relative; width: 9rem; height: 9rem; margin-bottom: 1.5rem; transform-style: preserve-3d;
            transform: rotateY(0deg);
        }
        .coin.flipping { animation: coin-toss ${COIN_FLIP_MS}ms cubic-bezier(0.2, 0.6, 0.35, 1) both; }
        .coin-face {
            position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; padding: 0.75rem;
            backface-visibility: hidden; -webkit-backface-visibility: hidden; box-sizing: border-box;
            border: 4px solid var(--fx-ink); text-align: center; overflow: hidden;
            font-weight: 900; font-size: 1.05rem; color: #3b2a00; line-height: 1.1; word-break: break-word;
        }
        .coin-face.front { background: radial-gradient(circle at 35% 30%, #fff7c2, #facc15 55%, #b45309); }
        .coin-face.back { background: radial-gradient(circle at 35% 30%, #f1f5f9, #cbd5e1 55%, #64748b); color: #1f2937; transform: rotateY(180deg); }
        .coin-face span { display: block; max-width: 100%; }
        .coin-shadow { position: absolute; bottom: 0.5rem; width: 6rem; height: 0.8rem; border-radius: 50%; background: rgb(0 0 0 / 0.45); }
        .coin-shadow.flipping { animation: coin-shadow ${COIN_FLIP_MS}ms cubic-bezier(0.2, 0.6, 0.35, 1) both; }
        .coin-result {
            margin: 0; min-height: 2rem; font-weight: 900; font-size: 1.4rem; color: #fff; text-align: center;
            -webkit-text-stroke: 1px var(--fx-ink); paint-order: stroke fill; text-shadow: 3px 3px 0 var(--fx-ink);
            opacity: 0; transform: scale(0.5); transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.2, 1.6, 0.4, 1);
        }
        .coin-result.visible { opacity: 1; transform: scale(1); }
        @keyframes coin-toss {
            0% { transform: translateY(0) rotateY(0deg); }
            45% { transform: translateY(-8rem) rotateY(calc(var(--final) * 0.6)); }
            85% { transform: translateY(0) rotateY(calc(var(--final) - 25deg)); }
            92% { transform: translateY(-0.8rem) rotateY(calc(var(--final) + 8deg)); }
            100% { transform: translateY(0) rotateY(var(--final)); }
        }
        @keyframes coin-shadow {
            0%, 100% { transform: scale(1); opacity: 1; }
            45% { transform: scale(0.4); opacity: 0.4; }
            85% { transform: scale(1); opacity: 1; }
        }
    `]
})
export class TiebreakCoinComponent implements OnInit, OnDestroy {
    private audio = inject(AudioService);

    names = input.required<string[]>();
    /** Índice del nombre ganador (0 o 1). */
    winner = input<number>(0);

    flipping = signal(false);
    landed = signal(false);
    /** Muchas vueltas y cae mostrando la cara del ganador (la de atrás está girada 180º). */
    finalRotation = computed(() => `${360 * 9 + (this.winner() === 1 ? 180 : 0)}deg`);
    private timers: ReturnType<typeof setTimeout>[] = [];

    ngOnInit(): void {
        if (prefersReducedMotion()) {
            this.landed.set(true);
            return;
        }
        this.timers.push(setTimeout(() => {
            this.flipping.set(true);
            this.audio.playCoinFlip(COIN_FLIP_MS / 1000);
        }, 300));
        this.timers.push(setTimeout(() => {
            this.landed.set(true);
            this.audio.playCoinLand();
        }, 300 + COIN_FLIP_MS));
    }

    ngOnDestroy(): void {
        this.timers.forEach(clearTimeout);
    }
}
