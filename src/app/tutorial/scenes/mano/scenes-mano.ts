import { Component, input } from '@angular/core';
import { TutorialSceneId } from '../../tutorial-scenes';
import { COMODIN_CARDS } from '../../../game/components/comodin-hand/comodin-cards';
import { ComodinTipo } from '../../../game/models/game.models';

interface DemoCard {
    tipo: ComodinTipo;
    uses: number;
}

/** Huecos de la ruleta (mismos que el servidor, ComodinReglas.HuecosRuleta). */
const HUECOS = [1, 2, 0, 1, 2, 1, 2, 3, 1, 2, 1, 2, 0, 1, 2, 1, 2, 3, 1, 2];
const HUECO_COLOR = ['#475569', '#0ea5e9', '#22c55e', '#f59e0b'];

/** Escenas de comodines: la mano de cartas y los comodines de tu turno. */
@Component({
    selector: 'app-tut-scenes-mano',
    standalone: true,
    templateUrl: './scenes-mano.html',
    styleUrls: ['./scenes-mano.scss', './scenes-mano-turno.scss']
})
export class ScenesManoComponent {
    scene = input.required<TutorialSceneId>();
    readonly info = COMODIN_CARDS;

    readonly turnCards: DemoCard[] = [
        { tipo: 'Ruleta', uses: 1 }, { tipo: 'CincuentaCincuenta', uses: 1 }, { tipo: 'CambiarPregunta', uses: 1 },
        { tipo: 'DobleONada', uses: 2 }, { tipo: 'Llamada', uses: 1 }
    ];
    readonly attackCards: DemoCard[] = [
        { tipo: 'Robo', uses: 1 }, { tipo: 'Apuesta', uses: 1 }, { tipo: 'CambiarPreguntaRival', uses: 2 }
    ];

    /** Posición de cada carta del abanico (como en la mano real: arco de ±12º). */
    fan(i: number, total: number): Record<string, string> {
        const half = (total - 1) / 2;
        const offset = i - half;
        const angle = half > 0 ? (offset / half) * Math.min(12, 5 * half) : 0;
        return {
            '--fx': `${offset * Math.min(42, 200 / total)}px`,
            '--fy': `${Math.abs(offset) * 5}px`,
            '--fr': `${angle}deg`
        };
    }

    /** Escena "turno": respuestas (texto antes y después de cambiar la pregunta, cuándo se eliminan y destapan). */
    readonly answers = [
        { s: 'tri', old: 'Piano', neu: 'Danubio', r: '11.4s', e1: '', e2: '' },
        { s: 'sq', old: 'Órgano', neu: 'Volga', r: '11.8s', e1: '3.9s', e2: '' },
        { s: 'ci', old: 'Acordeón', neu: 'Rin', r: '12.2s', e1: '3.9s', e2: '6.0s' },
        { s: 'pe', old: 'Clavicémbalo', neu: 'Loira', r: '12.6s', e1: '', e2: '6.0s' }
    ];

    /** Cartas que se juegan en la escena "turno" y cuándo. */
    readonly played: { tipo: ComodinTipo; d: string }[] = [
        { tipo: 'Ruleta', d: '0.2s' }, { tipo: 'CincuentaCincuenta', d: '4.8s' }, { tipo: 'CambiarPregunta', d: '9s' },
        { tipo: 'DobleONada', d: '13.4s' }, { tipo: 'Llamada', d: '17.6s' }
    ];

    // ---------- Ruleta ----------
    readonly ruletaGradient = `conic-gradient(${HUECOS.map((v, i) => `${HUECO_COLOR[v]} ${i * 18}deg ${(i + 1) * 18}deg`).join(', ')})`;
    readonly ruletaLabels = HUECOS.map((v, i) => ({ v, a: `${i * 18 + 9}deg` }));
}
