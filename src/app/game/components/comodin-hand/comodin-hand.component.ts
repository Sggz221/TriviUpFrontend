import { Component, HostListener, OnDestroy, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ComodinTipo } from '../../models/game.models';
import { AudioService } from '../../../shared/services/audio.service';
import { COMODIN_CARDS, HandCard, PlayedCard } from './comodin-cards';

/** Carta quemándose: su filtro SVG se anima moviendo el umbral de la máscara de ruido. */
interface BurningCard {
    key: number;
    tipo: ComodinTipo;
    seed: number;
    /** Umbral de la máscara: de 1 (carta entera) a −1 (carta consumida). */
    threshold: number;
}

/**
 * Mano de comodines como cartas: una bandeja oscura fija abajo con las cartas en abanico; al tocarla se
 * despliega un carril horizontal con todas las cartas a tamaño completo. Cada carta muestra sus usos arriba a
 * la derecha y, al gastar el último, se quema (filtro SVG de ruido con borde incandescente, sin WebGL).
 *
 * El componente queda montado durante toda la partida (aunque la mano se oculte) para poder quemar la carta
 * aunque jugarla cambie el turno o cierre la pregunta.
 */
@Component({
    selector: 'app-comodin-hand',
    standalone: true,
    templateUrl: './comodin-hand.component.html',
    styleUrl: './comodin-hand.component.scss'
})
export class ComodinHandComponent implements OnDestroy {
    private audio = inject(AudioService);

    /** Cartas que se pueden ver ahora (las de turno en tu turno, las de ataque fuera de él). */
    cards = input<HandCard[]>([]);
    /** Si la bandeja está a la vista (pregunta en juego, sin resultado ni pausa...). */
    visible = input<boolean>(false);
    /** Usos que te quedan de cada comodín (todos, no solo los visibles): sirve para saber cuándo quemar. */
    remaining = input<Partial<Record<ComodinTipo, number>>>({});
    /** Hay un comodín enviándose: no se puede jugar otro. */
    busy = input<boolean>(false);
    /** Jugador sobre el que se apuesta. */
    betTarget = input<string>('');

    play = output<PlayedCard>();

    readonly info = COMODIN_CARDS;
    expanded = signal(false);
    /** Apuesta: la carta está girada mostrando "Acierta / Falla". */
    betOpen = signal(false);
    burning = signal<BurningCard[]>([]);

    /** Última carta jugada: si con eso se queda sin usos, se quema. */
    private lastPlayed: { tipo: ComodinTipo; before: number; at: number } | null = null;
    private burnSeq = 0;
    private frames = new Map<number, number>();

    constructor() {
        effect(() => {
            const remaining = this.remaining();
            untracked(() => this.checkBurn(remaining));
        });
        // Al ocultarse la mano se pliega para la próxima vez.
        effect(() => {
            if (!this.visible()) {
                untracked(() => {
                    this.expanded.set(false);
                    this.betOpen.set(false);
                });
            }
        });
    }

    ngOnDestroy(): void {
        this.frames.forEach(id => cancelAnimationFrame(id));
    }

    toggle(): void {
        this.expanded.update(v => !v);
        this.betOpen.set(false);
    }

    close(): void {
        this.expanded.set(false);
        this.betOpen.set(false);
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.expanded()) this.close();
    }

    onCard(card: HandCard): void {
        if (!card.enabled || this.busy()) return;
        if (card.tipo === 'Apuesta') {
            this.betOpen.update(v => !v);
            return;
        }
        this.emit({ tipo: card.tipo });
    }

    bet(predictsCorrect: boolean): void {
        this.emit({ tipo: 'Apuesta', predictsCorrect });
    }

    /** Posición de cada carta en el abanico plegado: repartidas en arco, como una mano de naipes (±12º). */
    fanStyle(index: number, total: number): string {
        const half = (total - 1) / 2;
        const offset = index - half;
        const angle = half > 0 ? (offset / half) * Math.min(12, 5 * half) : 0;
        const x = offset * Math.min(42, 200 / Math.max(1, total));
        const y = Math.abs(offset) * 5;
        return `translate(calc(-50% + ${x}px), ${y}px) rotate(${angle}deg)`;
    }

    /**
     * Parámetros del filtro de quemado. El ruido (0-1) se convierte en máscara con alfa = 12·(ruido − corte):
     * lo que queda por debajo del corte se ha quemado. `edge` adelanta el corte para dibujar el borde
     * incandescente justo delante de lo quemado.
     */
    burnIntercept(b: BurningCard, edge = false): number {
        const cutoff = (1 - b.threshold) / 2 * 1.2 - 0.1 - (edge ? 0.09 : 0);
        return -12 * cutoff;
    }

    stackDepth(uses: number): number {
        return Math.min(2, Math.max(0, uses - 1));
    }

    ariaLabel(card: HandCard): string {
        const info = this.info[card.tipo];
        const usos = card.uses === 1 ? '1 uso' : `${card.uses} usos`;
        return `${info.name}, ${usos}. ${info.description}${card.enabled ? '' : '. No se puede jugar ahora'}`;
    }

    private emit(played: PlayedCard): void {
        this.lastPlayed = { tipo: played.tipo, before: this.remaining()[played.tipo] ?? 1, at: Date.now() };
        this.play.emit(played);
        this.close();
    }

    /** Si la última carta jugada se ha quedado sin usos, se quema. */
    private checkBurn(remaining: Partial<Record<ComodinTipo, number>>): void {
        const played = this.lastPlayed;
        if (!played || Date.now() - played.at > 10000) return;
        const now = remaining[played.tipo] ?? 0;
        if (now >= played.before) return; // aún no ha llegado la confirmación del servidor
        this.lastPlayed = null;
        if (now === 0) this.burn(played.tipo);
    }

    private burn(tipo: ComodinTipo): void {
        const key = ++this.burnSeq;
        this.burning.update(list => [...list, { key, tipo, seed: Math.floor(Math.random() * 1000), threshold: 1 }]);
        this.audio.playBurn();

        const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration = reduced ? 400 : 1300;
        const start = performance.now();
        const step = (t: number) => {
            const p = Math.min(1, (t - start) / duration);
            // Empieza despacio (prende) y acelera (se consume)
            const eased = p * p;
            this.burning.update(list => list.map(b => b.key === key ? { ...b, threshold: 1 - eased * 2.2 } : b));
            if (p < 1) {
                this.frames.set(key, requestAnimationFrame(step));
            } else {
                this.frames.delete(key);
                this.burning.update(list => list.filter(b => b.key !== key));
            }
        };
        this.frames.set(key, requestAnimationFrame(step));
    }
}
