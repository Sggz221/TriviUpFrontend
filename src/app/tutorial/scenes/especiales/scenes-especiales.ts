import { Component, input } from '@angular/core';
import { TutorialSceneId } from '../../tutorial-scenes';

/** Escenas de las preguntas especiales (sin turno): pulsador, colores y ocarina. */
@Component({
    selector: 'app-tut-scenes-especiales',
    standalone: true,
    templateUrl: './scenes-especiales.html',
    styleUrl: './scenes-especiales.scss'
})
export class ScenesEspecialesComponent {
    scene = input.required<TutorialSceneId>();

    /** Botones de la ocarina (como en la partida: A y los cuatro C). */
    readonly buttons = [
        { glyph: 'A', name: 'Re', a: true }, { glyph: '▼', name: 'Fa' }, { glyph: '▶', name: 'La' },
        { glyph: '◀', name: 'Si' }, { glyph: '▲', name: 'Re' }
    ];
    /** Melodía de la demo (La, Re, Fa, La) y cuándo suena / cuándo la tocas. */
    readonly melody = [2, 0, 1, 2];
    readonly listenAt = [1.0, 1.5, 2.0, 2.5];
    readonly playAt = [4.2, 4.8, 5.4, 6.0];

    /** Altura de la nota en el pentagrama (px desde arriba) según el botón. */
    noteY(pitch: number): number {
        return 46 - pitch * 8;
    }

    /** Momentos en que se pulsa cada botón (para el dedo y el hundido). */
    pressesOf(button: number): number[] {
        return this.melody.map((p, i) => (p === button ? this.playAt[i] : -1)).filter(t => t >= 0);
    }
}
