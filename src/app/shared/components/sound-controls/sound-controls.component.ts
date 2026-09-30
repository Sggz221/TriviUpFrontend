import { Component, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';

/** Dos botones independientes: silenciar la música de fondo y silenciar los efectos de sonido. */
@Component({
    selector: 'app-sound-controls',
    standalone: true,
    templateUrl: './sound-controls.html',
    styleUrls: ['./sound-controls.scss']
})
export class SoundControlsComponent {
    protected audio = inject(AudioService);
}
