import { Component, HostListener, OnDestroy, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ComodinTipo } from '../../models/game.models';
import { AudioService } from '../../../shared/services/audio.service';
import { COMODIN_CARDS, HandCard, PlayedCard } from './comodin-cards';

/** Carta quemándose (animación CSS: mixin burn-card de game/styles/_game-pieces.scss). */
interface BurningCard {
    key: number;
    tipo: ComodinTipo;
}

/** Lo que dura la quema (igual que la animación pc-burn). */
const BURN_MS = 1700;

/**
 * Mano de comodines como cartas: una bandeja oscura fija abajo con las cartas en abanico; al tocarla se
 * despliega un carril horizontal con todas las cartas a tamaño completo. Cada carta muestra sus usos arriba a
 * la derecha y, al gastar el último, se quema: se levanta y el fuego se la come desde una esquina con un borde
 * incandescente y brasas (como en el tutorial).
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
    private burnTimers = new Set<ReturnType<typeof setTimeout>>();

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
        this.burnTimers.forEach(t => clearTimeout(t));
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
        this.burning.update(list => [...list, { key, tipo }]);
        this.audio.playBurn();

        const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = setTimeout(() => {
            this.burnTimers.delete(timer);
            this.burning.update(list => list.filter(b => b.key !== key));
        }, reduced ? 400 : BURN_MS);
        this.burnTimers.add(timer);
    }
}
