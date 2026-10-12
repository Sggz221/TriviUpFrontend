import { Injectable, signal } from '@angular/core';
import { TutorialChapterId } from './tutorial-scenes';

/**
 * Abre y cierra el tutorial animado de la partida. El reproductor vive en la raíz de la app (app.html) y se
 * descarga la primera vez que se abre, así que cualquier página puede lanzarlo con `open()`.
 */
@Injectable({ providedIn: 'root' })
export class TutorialService {
    readonly isOpen = signal(false);
    /** Capítulo por el que empieza (null = desde el principio). */
    readonly startChapter = signal<TutorialChapterId | null>(null);

    open(chapter: TutorialChapterId | null = null): void {
        this.startChapter.set(chapter);
        this.isOpen.set(true);
    }

    close(): void {
        this.isOpen.set(false);
    }
}
