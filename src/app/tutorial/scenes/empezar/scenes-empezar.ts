import { Component, input } from '@angular/core';
import { TutorialSceneId } from '../../tutorial-scenes';
import { typed } from '../tutorial-bits';

/** Escenas "Entrar en la partida": presentación y unirse a la sala. */
@Component({
    selector: 'app-tut-scenes-empezar',
    standalone: true,
    templateUrl: './scenes-empezar.html',
    styleUrl: './scenes-empezar.scss'
})
export class ScenesEmpezarComponent {
    scene = input.required<TutorialSceneId>();

    readonly code = typed('QZ4K7M', 1.0, 0.25);
    readonly name = typed('Lucía', 3.8, 0.2);
    /** Patrón del QR de la pantalla del anfitrión (decorativo). */
    readonly qr = Array.from({ length: 49 }, (_, i) => [0, 1, 2, 7, 9, 14, 15, 16, 4, 5, 6, 11, 13, 18, 19, 20,
        28, 29, 30, 35, 37, 42, 43, 44, 24, 17, 22, 26, 31, 33, 39, 40, 46, 48, 10, 38].includes(i));
}
