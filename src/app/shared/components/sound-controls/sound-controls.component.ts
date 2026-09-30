import { Component, inject, signal } from '@angular/core';
import { AudioService } from '../../services/audio.service';

/** Sonido de la partida: botones para silenciar la música y los efectos por separado, y un panel con el volumen de cada canal. */
@Component({
    selector: 'app-sound-controls',
    standalone: true,
    templateUrl: './sound-controls.html',
    styleUrls: ['./sound-controls.scss']
})
export class SoundControlsComponent {
    protected audio = inject(AudioService);
    protected panelOpen = signal(false);

    protected togglePanel(): void {
        this.panelOpen.update(open => !open);
    }

    /** El valor del slider va de 0 a 100. */
    protected onMusicVolume(event: Event): void {
        this.audio.setMusicVolume(Number((event.target as HTMLInputElement).value) / 100);
    }

    protected onSfxVolume(event: Event): void {
        this.audio.setSfxVolume(Number((event.target as HTMLInputElement).value) / 100);
    }
}
