import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CuestionarioService } from '../../services/cuestionario.service';
import { Cuestionario, FasePool, Pregunta, Respuesta, colorDificultad, etiquetaDificultad } from '../../models/cuestionario.model';
import { colorDeFase } from '../../models/fase-color';
import { GameSignalrService } from '../../../game/services/game-signalr.service';
import { ComodinTipo, GameMode } from '../../../game/models/game.models';
import { AuthService } from '../../../auth/auth.service';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { AnswerShapeComponent, ShapeType } from '../../../shared/components/answer-shape/answer-shape';

interface FaseDetalle {
    numero: number;
    titulo: string;
    color: string;
    pool: FasePool | null;
    /** Preguntas fijas con su número dentro del cuestionario. */
    preguntas: { pregunta: Pregunta; numero: number }[];
}

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

    /**
     * Fases del cuestionario en orden: las de preguntas fijas (numeradas de forma continua) y las
     * de pool, que no tienen preguntas propias.
     */
    fases = computed<FaseDetalle[]>(() => {
        const quiz = this.cuestionario();
        if (!quiz) return [];

        const porFase = new Map<number, Pregunta[]>();
        for (const p of [...quiz.preguntas].sort((a, b) => a.numeroPregunta - b.numeroPregunta)) {
            const numero = p.faseNumero ?? 1;
            porFase.set(numero, [...(porFase.get(numero) ?? []), p]);
        }
        const pools = new Map((quiz.pools ?? []).map(p => [p.faseNumero, p]));
        const numeros = [...new Set([...porFase.keys(), ...pools.keys()])].sort((a, b) => a - b);

        let contador = 0;
        return numeros.map(numero => {
            const pool = pools.get(numero) ?? null;
            const preguntas = porFase.get(numero) ?? [];
            const nombre = pool ? pool.faseNombre : preguntas[0]?.faseNombre;
            return {
                numero,
                titulo: nombre ? `Fase ${numero} · ${nombre}` : `Fase ${numero}`,
                color: colorDeFase(numero, pool ? pool.faseColor : preguntas[0]?.faseColor),
                pool,
                preguntas: preguntas.map(pregunta => ({ pregunta, numero: ++contador }))
            };
        });
    });

    /** Con una sola fase sin nombre no se muestran cabeceras de fase. */
    mostrarCabeceras = computed(() => {
        const fases = this.fases();
        return fases.length > 1 || fases.some(f => f.pool || f.titulo !== `Fase ${f.numero}`);
    });

    /** Resumen de preguntas: las fijas más las que salen del banco en cada partida. */
    resumenPreguntas = computed(() => {
        const quiz = this.cuestionario();
        if (!quiz) return '';
        const delBanco = (quiz.pools ?? []).reduce((total, p) => total + p.cantidad, 0);
        const n = quiz.preguntas.length;
        const fijas = `${n} pregunta${n === 1 ? '' : 's'}`;
        return delBanco > 0 ? `${fijas} + ${delBanco} al azar del banco` : fijas;
    });

    /** Descripción de un pool: cuántas salen y de dónde. */
    descripcionPool(pool: FasePool): string {
        const salen = `Salen ${pool.cantidad} pregunta(s) al azar`;
        if (pool.origen === 'manual') {
            return `${salen} entre ${pool.preguntas.length} elegida(s) a mano del banco`;
        }
        const filtros = [pool.categoriaNombre, pool.dificultad ? etiquetaDificultad(pool.dificultad) : null].filter(Boolean);
        return filtros.length > 0
            ? `${salen} del banco (${filtros.join(' · ')})`
            : `${salen} de todo el banco`;
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

    /** Paso previo a crear la sala: el anfitrión elige el modo en unas tarjetas. */
    eligiendoModo = signal(false);

    abrirSelectorModo(): void {
        this.eligiendoModo.set(true);
    }

    cerrarSelectorModo(): void {
        if (!this.creandoSala()) this.eligiendoModo.set(false);
    }

    /** Comodines configurables de la sala: cuáles están activos y cuántas veces puede usarlos cada jugador. */
    readonly comodinesSala: { tipo: ComodinTipo; etiqueta: string; soloPresencial?: boolean }[] = [
        { tipo: 'Ruleta', etiqueta: 'Ruleta' },
        { tipo: 'DobleONada', etiqueta: 'Doble o nada' },
        { tipo: 'Robo', etiqueta: 'Robo' },
        { tipo: 'Apuesta', etiqueta: 'Apuesta' },
        { tipo: 'Llamada', etiqueta: 'Llamada', soloPresencial: true }
    ];
    /** Tope de usos por comodín (el mismo que valida el servidor, ComodinReglas.MaxUsos). */
    readonly maxUsos = 99;
    comodinConfig = signal<Record<ComodinTipo, { activo: boolean; usos: number }>>({
        Ruleta: { activo: true, usos: 1 },
        DobleONada: { activo: true, usos: 1 },
        Robo: { activo: true, usos: 1 },
        Apuesta: { activo: true, usos: 1 },
        Llamada: { activo: true, usos: 1 }
    });

    onComodinActivoChange(tipo: ComodinTipo, event: Event): void {
        const activo = (event.target as HTMLInputElement).checked;
        this.comodinConfig.update(c => ({ ...c, [tipo]: { ...c[tipo], activo } }));
    }

    onComodinUsosChange(tipo: ComodinTipo, event: Event): void {
        const input = event.target as HTMLInputElement;
        const usos = Math.min(this.maxUsos, Math.max(1, Math.floor(Number(input.value)) || 1));
        input.value = String(usos);
        this.comodinConfig.update(c => ({ ...c, [tipo]: { ...c[tipo], usos } }));
    }

    /** Config a enviar al crear la sala; null si se deja como viene por defecto (todos, un uso). */
    private comodinesParaEnviar(modo: GameMode): Partial<Record<ComodinTipo, number>> | null {
        const config = this.comodinConfig();
        const delModo = this.comodinesSala.filter(c => !c.soloPresencial || modo === 'Presencial');
        if (delModo.every(c => config[c.tipo].activo && config[c.tipo].usos === 1)) return null;
        const resultado: Partial<Record<ComodinTipo, number>> = {};
        for (const c of delModo) {
            if (config[c.tipo].activo) resultado[c.tipo] = config[c.tipo].usos;
        }
        return resultado;
    }

    onTiempoTurnoChange(event: Event): void {
        this.tiempoTurno.set(Number((event.target as HTMLSelectElement).value));
    }

    /** Crea la sala en el modo elegido. Presencial: el anfitrión marca y confirma las respuestas que dicen los jugadores. */
    crearSalaJuego(modo: GameMode): void {
        const quiz = this.cuestionario();
        if (!quiz || this.creandoSala()) return;

        this.creandoSala.set(true);

        // Conectar al GameHub con el token JWT
        const token = this.authService.getToken();
        if (!token) {
            this.errorMessage.set('Debes iniciar sesión para crear una sala');
            this.creandoSala.set(false);
            this.eligiendoModo.set(false);
            return;
        }

        this.gameSignalrService.connect(token).then(() => {
            // Invocar CreateGame en el hub
            // En modo presencial no hay tiempo por turno (el servidor también lo fuerza).
            return this.gameSignalrService.createGame(quiz.id, modo === 'Presencial' ? 0 : this.tiempoTurno(), modo, this.comodinesParaEnviar(modo));
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
            this.eligiendoModo.set(false);
        });
    }
}
