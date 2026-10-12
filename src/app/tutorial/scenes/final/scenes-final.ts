import { Component, input } from '@angular/core';
import { TutorialSceneId } from '../../tutorial-scenes';
import { CONFETTI } from '../tutorial-bits';

interface Kick {
    row: 0 | 1;
    slot: number;
    scored: boolean;
    at: number;
}

/** Escenas finales: fin de fase, podio con penaltis, normas rápidas y despedida. */
@Component({
    selector: 'app-tut-scenes-final',
    standalone: true,
    templateUrl: './scenes-final.html',
    styleUrl: './scenes-final.scss'
})
export class ScenesFinalComponent {
    scene = input.required<TutorialSceneId>();
    readonly confetti = CONFETTI;

    /** Tanda de penaltis Lucía (fila 0) contra Marcos (fila 1), tirando por turnos: gana Lucía 4-3. */
    readonly kicks: Kick[] = [true, true, false, true, true, false, true, true, true, false].map((scored, i) => ({
        row: (i % 2) as 0 | 1,
        slot: Math.floor(i / 2),
        scored,
        at: 6.6 + i * 0.4
    }));

    kicksOf(row: 0 | 1): Kick[] {
        return this.kicks.filter(k => k.row === row);
    }

    readonly rules = [
        { icon: '⏸️', title: 'Pausa', text: 'El anfitrión puede pausar cuando quiera', at: 0.4 },
        { icon: '🔁', title: '¿Se cerró la app?', text: 'Vuelve a entrar: sigues con tus puntos y comodines', at: 2.4 },
        { icon: '👀', title: 'Espectadores', text: 'Ven la partida, pero no juegan', at: 4.4 },
        { icon: '🃏', title: 'Comodines a medida', text: 'El anfitrión elige cuáles hay, sus usos… y puede devolvértelos', at: 6.4 },
        { icon: '🎉', title: 'Lo importante', text: 'Escuchar, hablar claro… ¡y divertirse!', at: 8.4 }
    ];
}
