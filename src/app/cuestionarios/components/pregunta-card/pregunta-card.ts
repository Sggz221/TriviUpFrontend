import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Pregunta, Respuesta } from '../../models/cuestionario.model';

@Component({
    selector: 'app-pregunta-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './pregunta-card.html',
    styleUrls: ['./pregunta-card.css']
})
export class PreguntaCardComponent {
    @Input() pregunta!: Pregunta;

    obtenerRespuestaCorrecta(pregunta: Pregunta): Respuesta | undefined {
        return pregunta.respuestas.find(r => r.esCorrecta);
    }

    getImageUrl(): string | null {
        return this.pregunta.imagenUrl ?? null;
    }
}
