import { Component } from '@angular/core';
import { COMODIN_CARDS } from '../../../game/components/comodin-hand/comodin-cards';
import { ComodinTipo } from '../../../game/models/game.models';

/** Escena de los comodines de ataque (turno de Marcos): robar, apostar y cambiar su pregunta. */
@Component({
    selector: 'app-tut-scenes-ataques',
    standalone: true,
    templateUrl: './scenes-ataques.html',
    styleUrl: './scenes-ataques.scss'
})
export class ScenesAtaquesComponent {
    readonly info = COMODIN_CARDS;
    readonly fanCards: ComodinTipo[] = ['Robo', 'Apuesta', 'CambiarPreguntaRival'];

    fan(i: number, total: number): Record<string, string> {
        const half = (total - 1) / 2;
        const offset = i - half;
        const angle = half > 0 ? (offset / half) * Math.min(12, 5 * half) : 0;
        return { '--fx': `${offset * 42}px`, '--fy': `${Math.abs(offset) * 5}px`, '--fr': `${angle}deg` };
    }
}
