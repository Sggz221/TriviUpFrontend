import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CuestionarioService } from '../../services/cuestionario.service';
import { Cuestionario, Pregunta, Respuesta, colorDificultad, etiquetaDificultad } from '../../models/cuestionario.model';
import { GameSignalrService } from '../../../game/services/game-signalr.service';
import { AuthService } from '../../../auth/auth.service';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { AnswerShapeComponent, ShapeType } from '../../../shared/components/answer-shape/answer-shape';

@Component({
    selector: 'app-quiz-detail',
    standalone: true,
    imports: [CommonModule, RouterLink, AnswerShapeComponent],
    templateUrl: './quiz-detail.html',
    styleUrls: ['./quiz-detail.css']
})
export class QuizDetailComponent implements OnInit {
    readonly colorDificultad = colorDificultad;
    readonly etiquetaDificultad = etiquetaDificultad;

    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cuestionarioService = inject(CuestionarioService);
    private gameSignalrService = inject(GameSignalrService);
    private authService = inject(AuthService);

    cuestionario = signal<Cuestionario | null>(null);
    isLoading = signal(true);
    errorMessage = signal<string | null>(null);
    copied = signal(false);
    creandoSala = signal(false);

    ngOnInit(): void {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (id) {
            this.cargarQuiz(id);
        }
    }

    cargarQuiz(id: number): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.cuestionarioService.obtenerQuiz(id).subscribe({
            next: (quiz) => {
                this.cuestionario.set(quiz);
                this.isLoading.set(false);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(
                    err.error?.message || 'No se pudo cargar el cuestionario.'
                );
            }
        });
    }

    copiarGameCode(gameCode: string): void {
        // Intentar primero con la API moderna del portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(gameCode).then(() => {
                this.copied.set(true);
                setTimeout(() => this.copied.set(false), 2000);
            }).catch(() => {
                this.fallbackCopy(gameCode);
            });
        } else {
            this.fallbackCopy(gameCode);
        }
    }

    private fallbackCopy(gameCode: string): void {
        // Fallback para navegadores que no soportan la API moderna
        const textArea = document.createElement('textarea');
        textArea.value = gameCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        } catch (err) {
            console.error('Error al copiar al portapapeles:', err);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    obtenerRespuestaCorrecta(pregunta: Pregunta): Respuesta | undefined {
        return pregunta.respuestas.find(r => r.esCorrecta);
    }

    /** Título de la fase si la pregunta abre una (null si sigue en la misma fase o el cuestionario no tiene fases). */
    cabeceraFase(index: number): string | null {
        const preguntas = this.cuestionario()?.preguntas ?? [];
        const actual = preguntas[index];
        if (!actual) return null;

        const fase = actual.faseNumero ?? 1;
        if (index > 0 && (preguntas[index - 1].faseNumero ?? 1) === fase) return null;

        const hayVariasFases = new Set(preguntas.map(p => p.faseNumero ?? 1)).size > 1;
        if (!hayVariasFases && !actual.faseNombre) return null;

        return actual.faseNombre ? `Fase ${fase} · ${actual.faseNombre}` : `Fase ${fase}`;
    }

    obtenerLetraRespuesta(index: number): string {
        return String.fromCharCode(65 + index); // A, B, C, D...
    }

    obtenerShapeRespuesta(index: number): ShapeType {
        const shapes: ShapeType[] = ['triangle', 'square', 'circle', 'pentagon'];
        return shapes[index] || 'triangle';
    }

    formatearFecha(fecha: string): string {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    obtenerQuizUrl(): string {
        const gameCode = this.cuestionario()?.gameCode;
        if (!gameCode) return '';
        // Usar window.location.origin para obtener el dominio actual
        return `${window.location.origin}/cuestionarios/${gameCode}`;
    }

    obtenerImagenPreguntaUrl(path: string | null | undefined): string | null {
        if (!path) return null;
        return imageUrl(path);
    }

    /** Segundos por turno elegidos para la sala (0 = sin tiempo). */
    tiempoTurno = signal<number>(20);
    readonly opcionesTiempo = [
        { valor: 10, etiqueta: '10 s' },
        { valor: 15, etiqueta: '15 s' },
        { valor: 20, etiqueta: '20 s' },
        { valor: 30, etiqueta: '30 s' },
        { valor: 45, etiqueta: '45 s' },
        { valor: 60, etiqueta: '60 s' },
        { valor: 0, etiqueta: 'Sin tiempo' }
    ];

    onTiempoTurnoChange(event: Event): void {
        this.tiempoTurno.set(Number((event.target as HTMLSelectElement).value));
    }

    crearSalaJuego(): void {
        const quiz = this.cuestionario();
        if (!quiz) return;

        this.creandoSala.set(true);

        // Conectar al GameHub con el token JWT
        const token = this.authService.getToken();
        if (!token) {
            this.errorMessage.set('Debes iniciar sesión para crear una sala');
            this.creandoSala.set(false);
            return;
        }

        this.gameSignalrService.connect(token).then(() => {
            // Invocar CreateGame en el hub
            return this.gameSignalrService.createGame(quiz.id, this.tiempoTurno());
        }).then((roomCode) => {
            console.log('[QuizDetail] ★★★ Sala creada:', roomCode);
            // Indicar que este usuario es el owner
            console.log('[QuizDetail] ★★★ Calling setIsOwner(true)');
            this.gameSignalrService.setIsOwner(true);
            console.log('[QuizDetail] ★★★ After setIsOwner, service.isOwner():', this.gameSignalrService.isOwner());
            // Navegar a la página de la sala
            this.router.navigate(['/game', roomCode]);
        }).catch((error) => {
            console.error('[QuizDetail] Error al crear sala:', error);
            this.errorMessage.set('Error al crear la sala de juego');
            this.creandoSala.set(false);
        });
    }
}
