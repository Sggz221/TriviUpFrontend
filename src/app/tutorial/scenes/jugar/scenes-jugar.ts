import { Component, input } from '@angular/core';
import { TutorialSceneId } from '../../tutorial-scenes';
import { CONFETTI } from '../tutorial-bits';

/** Escenas "Turnos y respuestas": fases y turnos, la pregunta, responder en voz alta y fallar. */
@Component({
    selector: 'app-tut-scenes-jugar',
    standalone: true,
    templateUrl: './scenes-jugar.html',
    styleUrl: './scenes-jugar.scss'
})
export class ScenesJugarComponent {
    scene = input.required<TutorialSceneId>();
    readonly confetti = CONFETTI;
    /** Momento en que el anfitrión destapa cada respuesta (escena "pregunta"). */
    readonly reveals = ['3.2s', '4.3s', '5.4s', '6.5s'];
}
