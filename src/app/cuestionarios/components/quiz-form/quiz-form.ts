import { Component, signal, inject, computed, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CuestionarioService } from '../../services/cuestionario.service';
import { Cuestionario, CreateQuizRequest, QuizVersion, BancoPregunta, BancoCategoria, Dificultad } from '../../models/cuestionario.model';
import { BancoPreguntasService } from '../../services/banco-preguntas.service';
import { BancoCategoriasService } from '../../services/banco-categorias.service';
import { BancoPickerComponent } from '../banco-picker/banco-picker';
import { CategoriaElegida, CategoriaSelectorComponent } from '../../../shared/components/categoria-selector/categoria-selector';
import { DificultadSelectorComponent } from '../../../shared/components/dificultad-selector/dificultad-selector';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { PALETA_FASES, colorDeFase, esColorValido } from '../../models/fase-color';
import { AnswerShapeComponent, ShapeType } from '../../../shared/components/answer-shape/answer-shape';

interface RespuestaFormValue {
    texto: string;
    esCorrecta: boolean;
}

/** Elemento de la lista del builder: una pregunta o un separador de fase. */
interface PreguntaFormValue {
    tipo: 'pregunta' | 'separador';
    /** Nombre de la fase (solo separadores). */
    nombre?: string;
    /** Color de la fase #rrggbb, vacío = por defecto (solo separadores). */
    color?: string;
    dificultad?: Dificultad | null;
    enunciado: string;
    respuestas: RespuestaFormValue[];
    imagenUrl?: string;
}

@Component({
    selector: 'app-quiz-form',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, RouterLink, AnswerShapeComponent, BancoPickerComponent,
        CategoriaSelectorComponent, DificultadSelectorComponent
    ],
    templateUrl: './quiz-form.html',
    styleUrls: ['./quiz-form.css']
})
export class QuizFormComponent {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private cuestionarioService = inject(CuestionarioService);
    private route = inject(ActivatedRoute);
    private location = inject(Location);
    private destroyRef = inject(DestroyRef);
    private bancoService = inject(BancoPreguntasService);
    private categoriasService = inject(BancoCategoriasService);

    /** Última categoría del banco usada al guardar una pregunta (se sugiere la siguiente vez). */
    private static readonly ULTIMA_CATEGORIA_KEY = 'triviup:banco:ultima-categoria';

    /** Intervalo de autoguardado del borrador (5 min). */
    private static readonly AUTOSAVE_MS = 5 * 60 * 1000;

    quizId = signal<number | null>(null);
    isEdit = computed(() => this.quizId() !== null);
    /** Nunca publicado: todo el contenido es un borrador. */
    isDraft = signal(false);
    /** Versión publicada actual (0 = nunca publicado). */
    version = signal(0);
    /** El cuestionario publicado tiene un borrador pendiente aparte. */
    tieneBorrador = signal(false);
    /** Borrador pendiente encontrado al abrir; el usuario decide si continuarlo o descartarlo. */
    borradorPendiente = signal<Cuestionario | null>(null);
    versiones = signal<QuizVersion[] | null>(null);
    mostrarHistorial = signal(false);
    esPublicado = computed(() => this.isEdit() && this.version() > 0);
    savingDraft = signal(false);
    lastSavedAt = signal<Date | null>(null);
    loadingQuiz = signal(false);

    isLoading = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    /** Atajos para nombrar una fase con la taxonomía que se prefiera (solo rellenan el nombre). */
    readonly presetsFase = ['Ronda', 'Categoría: ', 'Dificultad: '];

    /** Colores sugeridos para las fases; también se puede elegir cualquiera con el selector de color. */
    readonly paletaFases = PALETA_FASES;

    /** Panel para añadir preguntas desde el banco personal. */
    mostrarBanco = signal(false);

    /** Diálogo "Al banco": pregunta que se guarda y categoría elegida (existente o nueva). */
    dialogoBanco = signal<{
        index: number;
        categoriaId: number | null;
        categoriaNombre: string | null;
        guardando: boolean;
    } | null>(null);
    categoriasBanco = signal<BancoCategoria[]>([]);

    // Estado de las imágenes por pregunta. La clave es el control (no el índice) para que
    // insertar, mover o borrar elementos de la lista no desincronice las imágenes.
    questionImages = signal<Map<AbstractControl, { uploading: boolean; url: string | null; preview: string | null }>>(new Map());

    quizForm: FormGroup;

    constructor() {
        this.quizForm = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(3)]],
            esPublico: [false],
            preguntas: this.fb.array([])
        });

        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            this.cargarQuiz(Number(idParam));
        } else {
            // Add initial question
            this.agregarPregunta();
        }

        const timer = setInterval(() => this.autoguardar(), QuizFormComponent.AUTOSAVE_MS);
        this.destroyRef.onDestroy(() => clearInterval(timer));
    }

    private cargarQuiz(id: number): void {
        this.loadingQuiz.set(true);
        this.cuestionarioService.obtenerQuiz(id).subscribe({
            next: (quiz) => {
                this.quizId.set(quiz.id);
                this.isDraft.set(!!quiz.esBorrador);
                this.version.set(quiz.version ?? (quiz.esBorrador ? 0 : 1));
                this.rellenarFormulario(quiz);
                this.loadingQuiz.set(false);
                if (this.version() > 0) {
                    this.buscarBorradorPendiente(id);
                }
            },
            error: () => {
                this.loadingQuiz.set(false);
                this.errorMessage.set('No se pudo cargar el cuestionario.');
                this.agregarPregunta();
            }
        });
    }

    /** Un cuestionario publicado puede tener un borrador guardado antes; 404 = no hay. */
    private buscarBorradorPendiente(id: number): void {
        this.cuestionarioService.obtenerBorrador(id).subscribe({
            next: (borrador) => {
                this.tieneBorrador.set(true);
                this.borradorPendiente.set(borrador);
            },
            error: () => {
                this.tieneBorrador.set(false);
                this.borradorPendiente.set(null);
            }
        });
    }

    continuarBorrador(): void {
        const borrador = this.borradorPendiente();
        if (!borrador) return;
        this.rellenarFormulario(borrador);
        this.borradorPendiente.set(null);
        this.successMessage.set('Borrador cargado. Lo publicado no cambia hasta que pulses "Publicar cambios".');
        setTimeout(() => this.successMessage.set(null), 4000);
    }

    descartarBorrador(): void {
        const id = this.quizId();
        if (id === null || !confirm('¿Descartar el borrador? La versión publicada no se modifica.')) return;

        this.cuestionarioService.descartarBorrador(id).subscribe({
            next: () => {
                this.tieneBorrador.set(false);
                this.borradorPendiente.set(null);
                this.versiones.set(null);
                this.cargarQuiz(id);
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo descartar el borrador.')
        });
    }

    toggleHistorial(): void {
        const id = this.quizId();
        if (id === null) return;
        this.mostrarHistorial.update(v => !v);
        if (this.mostrarHistorial() && this.versiones() === null) {
            this.cuestionarioService.obtenerVersiones(id).subscribe({
                next: (v) => this.versiones.set(v),
                error: () => this.errorMessage.set('No se pudo cargar el historial.')
            });
        }
    }

    restaurarVersion(numero: number | null): void {
        const id = this.quizId();
        if (id === null || numero === null) return;

        this.cuestionarioService.restaurarVersion(id, numero).subscribe({
            next: (borrador) => {
                this.rellenarFormulario(borrador);
                this.borradorPendiente.set(null);
                this.tieneBorrador.set(true);
                this.versiones.set(null);
                this.mostrarHistorial.set(false);
                this.quizForm.markAsDirty();
                this.successMessage.set(`Versión ${numero} cargada como borrador. Publícala para que sea la versión activa.`);
                setTimeout(() => this.successMessage.set(null), 4000);
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo restaurar la versión.')
        });
    }

    private rellenarFormulario(quiz: Cuestionario): void {
        this.quizForm.patchValue({ nombre: quiz.nombre, esPublico: quiz.esPublico ?? false });
        this.preguntasArray.clear();
        const images = new Map<AbstractControl, { uploading: boolean; url: string | null; preview: string | null }>();

        const ordenadas = [...quiz.preguntas].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
        // Con una sola fase sin nombre no hace falta separador; en el resto, uno antes de cada fase
        const hayVariasFases = new Set(ordenadas.map(p => p.faseNumero ?? 1)).size > 1;
        let faseAnterior: number | null = null;

        ordenadas.forEach((p) => {
            const fase = p.faseNumero ?? 1;
            if (fase !== faseAnterior) {
                if (hayVariasFases || p.faseNombre) {
                    this.preguntasArray.push(this.crearSeparador(p.faseNombre ?? '', p.faseColor ?? ''));
                }
                faseAnterior = fase;
            }

            const grupo = this.crearPregunta({
                enunciado: p.enunciado,
                respuestas: p.respuestas,
                imagenUrl: p.imagenUrl ?? null,
                dificultad: p.dificultad ?? null
            });
            this.preguntasArray.push(grupo);
            if (p.imagenUrl) {
                images.set(grupo, { uploading: false, url: imageUrl(p.imagenUrl), preview: null });
            }
        });

        if (this.cantidadPreguntas === 0) {
            this.agregarPregunta();
        }
        this.questionImages.set(images);
        this.quizForm.markAsPristine();
    }

    get preguntasArray(): FormArray {
        return this.quizForm.get('preguntas') as FormArray;
    }

    private crearPregunta(datos?: {
        enunciado: string;
        respuestas: { texto: string; esCorrecta: boolean }[];
        imagenUrl?: string | null;
        dificultad?: Dificultad | null;
    }): FormGroup {
        const respuestas = datos?.respuestas ?? [
            { texto: '', esCorrecta: false },
            { texto: '', esCorrecta: false }
        ];
        return this.fb.group({
            tipo: ['pregunta'],
            dificultad: [(datos?.dificultad ?? null) as Dificultad | null],
            enunciado: [datos?.enunciado ?? '', Validators.required],
            respuestas: this.fb.array(respuestas.map(r => this.fb.group({
                texto: [r.texto, Validators.required],
                esCorrecta: [r.esCorrecta]
            }))),
            imagenUrl: [(datos?.imagenUrl ?? null) as string | null]
        });
    }

    private crearSeparador(nombre = '', color = ''): FormGroup {
        return this.fb.group({
            tipo: ['separador'],
            nombre: [nombre],
            color: [color]
        });
    }

    agregarPregunta(): void {
        this.preguntasArray.push(this.crearPregunta());
    }

    /** Añade un separador de fase al final; las preguntas que se añadan después pertenecen a la nueva fase. */
    agregarSeparador(): void {
        this.preguntasArray.push(this.crearSeparador());
        this.quizForm.markAsDirty();
    }

    esSeparador(control: AbstractControl): boolean {
        return control.get('tipo')?.value === 'separador';
    }

    /** Número de preguntas (sin contar separadores). */
    get cantidadPreguntas(): number {
        return this.preguntasArray.controls.filter(c => !this.esSeparador(c)).length;
    }

    /** Elimina una pregunta (siempre debe quedar al menos una) o un separador. */
    eliminarPregunta(index: number): void {
        const control = this.preguntasArray.at(index);
        if (!this.esSeparador(control) && this.cantidadPreguntas <= 1) return;

        this.preguntasArray.removeAt(index);
        const images = new Map(this.questionImages());
        images.delete(control);
        this.questionImages.set(images);
        this.quizForm.markAsDirty();
    }

    puedeEliminar(index: number): boolean {
        return this.esSeparador(this.preguntasArray.at(index)) || this.cantidadPreguntas > 1;
    }

    /** Sube (-1) o baja (+1) un elemento; mover una pregunta al otro lado de un separador la cambia de fase. */
    moverElemento(index: number, delta: -1 | 1): void {
        const destino = index + delta;
        if (destino < 0 || destino >= this.preguntasArray.length) return;

        const control = this.preguntasArray.at(index);
        this.preguntasArray.removeAt(index);
        this.preguntasArray.insert(destino, control);
        this.quizForm.markAsDirty();
    }

    /** Número de fase (1..n) que abre el separador de esa posición (uno inicial nombra la primera). */
    numeroFaseSeparador(index: number): number {
        let fase = 1;
        let hayPreguntas = false;
        for (let i = 0; i <= index; i++) {
            const control = this.preguntasArray.at(i);
            if (!this.esSeparador(control)) {
                hayPreguntas = true;
            } else if (hayPreguntas && i > 0) {
                fase++;
                hayPreguntas = false;
            }
        }
        return fase;
    }

    /** Color efectivo del separador: el elegido o el de la paleta según el número de fase. */
    colorSeparador(index: number): string {
        return colorDeFase(this.numeroFaseSeparador(index), this.preguntasArray.at(index).get('color')?.value);
    }

    /** ¿El separador usa un color elegido a mano (no el de por defecto)? */
    tieneColorPropio(index: number): boolean {
        return esColorValido(this.preguntasArray.at(index).get('color')?.value);
    }

    /** Fija el color de la fase; vacío vuelve al color por defecto. */
    aplicarColorFase(index: number, color: string): void {
        this.preguntasArray.at(index).patchValue({ color: esColorValido(color) ? color.toLowerCase() : '' });
        this.quizForm.markAsDirty();
    }

    /** Aplica un atajo de taxonomía al nombre del separador ("Ronda" pasa a "Ronda 2" según su posición). */
    aplicarPresetFase(index: number, preset: string): void {
        const numeroSeparador = this.preguntasArray.controls
            .slice(0, index + 1)
            .filter(c => this.esSeparador(c)).length;
        const nombre = preset === 'Ronda' ? `Ronda ${numeroSeparador}` : preset;
        this.preguntasArray.at(index).patchValue({ nombre });
        this.quizForm.markAsDirty();
    }

    // ===== Banco de preguntas =====

    toggleBanco(): void {
        this.mostrarBanco.update(v => !v);
    }

    /** Copia al final del cuestionario las preguntas elegidas en el banco (no quedan enlazadas). */
    agregarDesdeBanco(preguntas: BancoPregunta[]): void {
        const images = new Map(this.questionImages());

        // Si el formulario solo tiene la pregunta vacía inicial, se sustituye
        if (this.preguntasArray.length === 1 && this.preguntaVacia(this.preguntasArray.at(0))) {
            this.preguntasArray.clear();
        }

        for (const p of preguntas) {
            const grupo = this.crearPregunta({
                enunciado: p.enunciado,
                respuestas: p.respuestas,
                imagenUrl: p.imagenUrl ?? null,
                dificultad: p.dificultad ?? null
            });
            this.preguntasArray.push(grupo);
            if (p.imagenUrl) {
                images.set(grupo, { uploading: false, url: imageUrl(p.imagenUrl), preview: null });
            }
        }

        this.questionImages.set(images);
        this.quizForm.markAsDirty();
        this.mostrarBanco.set(false);
        this.successMessage.set(`${preguntas.length} pregunta(s) añadida(s) desde el banco.`);
        setTimeout(() => this.successMessage.set(null), 3000);
    }

    private preguntaVacia(control: AbstractControl): boolean {
        if (this.esSeparador(control)) return false;
        const respuestas = control.get('respuestas') as FormArray;
        return !control.get('enunciado')?.value?.trim() &&
            respuestas.controls.every(r => !r.get('texto')?.value?.trim());
    }

    /** Cambia la dificultad de una pregunta (volver a pulsar la activa la deja sin clasificar). */
    cambiarDificultad(index: number, dificultad: Dificultad | null): void {
        this.preguntasArray.at(index).patchValue({ dificultad });
        this.quizForm.markAsDirty();
    }

    /** Abre el diálogo para guardar la pregunta en el banco eligiendo (o creando) su categoría. */
    guardarEnBanco(index: number): void {
        if (!this.preguntaValidaParaBanco(index)) {
            this.errorMessage.set('Completa la pregunta (enunciado, respuestas y una correcta) antes de guardarla en el banco.');
            return;
        }

        this.errorMessage.set(null);
        this.dialogoBanco.set({ index, categoriaId: null, categoriaNombre: null, guardando: false });

        this.categoriasService.listar().subscribe({
            next: (r) => {
                this.categoriasBanco.set(r.categorias);
                // Se sugiere la última categoría usada, si todavía existe
                const ultima = this.leerUltimaCategoria();
                const dialogo = this.dialogoBanco();
                if (dialogo && ultima !== null && r.categorias.some(c => c.id === ultima)) {
                    this.dialogoBanco.set({ ...dialogo, categoriaId: ultima });
                }
            },
            error: () => this.categoriasBanco.set([])
        });
    }

    onCategoriaBanco(elegida: CategoriaElegida): void {
        const dialogo = this.dialogoBanco();
        if (dialogo) {
            this.dialogoBanco.set({ ...dialogo, ...elegida });
        }
    }

    cancelarGuardarEnBanco(): void {
        this.dialogoBanco.set(null);
    }

    confirmarGuardarEnBanco(): void {
        const dialogo = this.dialogoBanco();
        if (!dialogo || dialogo.guardando || !this.preguntaValidaParaBanco(dialogo.index)) return;

        const control = this.preguntasArray.at(dialogo.index);
        const respuestas = (control.get('respuestas') as FormArray).value as RespuestaFormValue[];
        const nombreNuevo = dialogo.categoriaId ? null : (dialogo.categoriaNombre?.trim() || null);

        this.dialogoBanco.set({ ...dialogo, guardando: true });
        this.bancoService.crear({
            enunciado: (control.get('enunciado')?.value ?? '').trim(),
            imagenUrl: control.get('imagenUrl')?.value || null,
            respuestas: respuestas.map(r => ({ texto: r.texto.trim(), esCorrecta: !!r.esCorrecta })),
            dificultad: control.get('dificultad')?.value ?? null,
            categoriaId: dialogo.categoriaId,
            categoriaNombre: nombreNuevo
        }).subscribe({
            next: (guardada) => {
                this.dialogoBanco.set(null);
                if (guardada.categoriaId) {
                    this.recordarUltimaCategoria(guardada.categoriaId);
                }
                this.successMessage.set(guardada.categoriaNombre
                    ? `Pregunta guardada en tu banco, en «${guardada.categoriaNombre}».`
                    : 'Pregunta guardada en tu banco sin categoría. Puedes clasificarla luego desde el banco.');
                setTimeout(() => this.successMessage.set(null), 4000);
            },
            error: (err) => {
                this.dialogoBanco.set({ ...dialogo, guardando: false });
                this.errorMessage.set(err.error?.message || 'No se pudo guardar la pregunta en el banco.');
            }
        });
    }

    private preguntaValidaParaBanco(index: number): boolean {
        const control = this.preguntasArray.at(index);
        const enunciado = (control.get('enunciado')?.value ?? '').trim();
        const respuestas = (control.get('respuestas') as FormArray).value as RespuestaFormValue[];
        return !!enunciado && respuestas.length >= 2 && respuestas.every(r => !!r.texto?.trim()) &&
            respuestas.filter(r => r.esCorrecta).length === 1;
    }

    private leerUltimaCategoria(): number | null {
        try {
            const valor = Number(localStorage.getItem(QuizFormComponent.ULTIMA_CATEGORIA_KEY));
            return Number.isFinite(valor) && valor > 0 ? valor : null;
        } catch {
            return null; // localStorage no disponible: simplemente no hay sugerencia
        }
    }

    private recordarUltimaCategoria(id: number): void {
        try {
            localStorage.setItem(QuizFormComponent.ULTIMA_CATEGORIA_KEY, String(id));
        } catch {
            // no crítico
        }
    }

    agregarRespuesta(preguntaIndex: number): void {
        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;
        if (respuestas.length >= 4) {
            this.errorMessage.set('Máximo 4 respuestas por pregunta');
            return;
        }
        respuestas.push(this.fb.group({
            texto: ['', Validators.required],
            esCorrecta: [false]
        }));
    }

    eliminarRespuesta(preguntaIndex: number, respuestaIndex: number, respuestaControl: AbstractControl): void {
        console.log('[eliminarRespuesta] INICIO');
        console.log('[eliminarRespuesta] preguntaIndex:', preguntaIndex);
        console.log('[eliminarRespuesta] respuestaIndex pasado:', respuestaIndex);
        console.log('[eliminarRespuesta] respuestaControl texto:', respuestaControl.get('texto')?.value);

        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;

        console.log('[eliminarRespuesta] Respuestas antes de eliminar:', respuestas.length);
        console.log('[eliminarRespuesta] Estado de respuestas antes:');
        for (let i = 0; i < respuestas.length; i++) {
            console.log(`  [${i}] texto: "${respuestas.at(i).get('texto')?.value}", esCorrecta: ${respuestas.at(i).get('esCorrecta')?.value}`);
        }

        if (respuestas.length > 2) {
            // Remove by control reference to ensure we remove the exact one
            const indexToRemove = respuestas.controls.indexOf(respuestaControl);
            console.log('[eliminarRespuesta] indexToRemove calculado:', indexToRemove);

            if (indexToRemove !== -1) {
                console.log('[eliminarRespuesta] ELIMINANDO respuesta en índice:', indexToRemove);
                respuestas.removeAt(indexToRemove);

                // Resetear todas las respuestas a esCorrecta: false para evitar inconsistencias visuales
                this.resetCorrectAnswer(preguntaIndex);

                console.log('[eliminarRespuesta] Respuestas después de eliminar:', respuestas.length);
                console.log('[eliminarRespuesta] Estado de respuestas después:');
                for (let i = 0; i < respuestas.length; i++) {
                    console.log(`  [${i}] texto: "${respuestas.at(i).get('texto')?.value}", esCorrecta: ${respuestas.at(i).get('esCorrecta')?.value}`);
                }
            } else {
                console.log('[eliminarRespuesta] ERROR: respuestaControl no encontrado en controls!');
            }
        } else {
            console.log('[eliminarRespuesta] No se puede eliminar, menos de 3 respuestas');
        }
    }

    setRespuestaCorrecta(preguntaIndex: number, respuestaIndex: number): void {
        console.log('[setRespuestaCorrecta] INICIO');
        console.log('[setRespuestaCorrecta] preguntaIndex:', preguntaIndex, 'respuestaIndex:', respuestaIndex);

        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;

        console.log('[setRespuestaCorrecta] Estado antes de cambiar:');
        for (let i = 0; i < respuestas.length; i++) {
            console.log(`  [${i}] texto: "${respuestas.at(i).get('texto')?.value}", esCorrecta: ${respuestas.at(i).get('esCorrecta')?.value}`);
        }

        // Desmarcar TODAS las respuestas primero (forzar una sola correcta)
        for (let i = 0; i < respuestas.length; i++) {
            respuestas.at(i).patchValue({ esCorrecta: false });
        }

        // Marcar solo la respuesta clickeada como correcta
        respuestas.at(respuestaIndex).patchValue({ esCorrecta: true });

        console.log('[setRespuestaCorrecta] Estado después de cambiar:');
        for (let i = 0; i < respuestas.length; i++) {
            console.log(`  [${i}] texto: "${respuestas.at(i).get('texto')?.value}", esCorrecta: ${respuestas.at(i).get('esCorrecta')?.value}`);
        }
    }

    private resetCorrectAnswer(preguntaIndex: number): void {
        // Cuando se elimina una respuesta, resetear todas las respuestas a esCorrecta: false
        // para evitar inconsistencias visuales
        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;
        for (let i = 0; i < respuestas.length; i++) {
            respuestas.at(i).patchValue({ esCorrecta: false });
        }
        console.log('[resetCorrectAnswer] Respuestas de pregunta', preguntaIndex, 'reseteadas a esCorrecta: false');
    }

    esRespuestaCorrecta(preguntaIndex: number, respuestaIndex: number): boolean {
        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;
        return respuestas.at(respuestaIndex).get('esCorrecta')?.value === true;
    }

    /** Número de la pregunta en el cuestionario (los separadores no cuentan). */
    obtenerNumeroPregunta(index: number): number {
        return this.preguntasArray.controls.slice(0, index + 1).filter(c => !this.esSeparador(c)).length;
    }

    obtenerNumeroRespuesta(preguntaIndex: number, index: number): string {
        return String.fromCharCode(65 + index); // A, B, C, D...
    }

    obtenerShapeRespuesta(index: number): ShapeType {
        const shapes: ShapeType[] = ['triangle', 'square', 'circle', 'pentagon'];
        return shapes[index] || 'triangle';
    }

    obtenerRespuestasFormArray(preguntaIndex: number): FormArray {
        const pregunta = this.preguntasArray.at(preguntaIndex);
        return pregunta.get('respuestas') as FormArray;
    }

    // Image handling
    onImageSelected(event: Event, preguntaIndex: number): void {
        const control = this.preguntasArray.at(preguntaIndex);
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        // Validate
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.errorMessage.set('Por favor, selecciona una imagen válida (JPG, PNG, GIF o WebP)');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.errorMessage.set('La imagen debe ser menor de 5MB');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = e.target?.result as string;

            // Update local state with preview
            const newMap = new Map(this.questionImages());
            newMap.set(control, { uploading: true, url: null, preview });
            this.questionImages.set(newMap);

            // Upload immediately
            this.cuestionarioService.subirImagenPregunta(file).subscribe({
                next: (response) => {
                    const updatedMap = new Map(this.questionImages());
                    updatedMap.set(control, { uploading: false, url: imageUrl(response.path), preview: null });
                    this.questionImages.set(updatedMap);

                    // Store the path (relative URL) in the form
                    control.patchValue({ imagenUrl: response.path });
                    this.quizForm.markAsDirty();
                },
                error: (err) => {
                    const updatedMap = new Map(this.questionImages());
                    updatedMap.delete(control);
                    this.questionImages.set(updatedMap);
                    this.errorMessage.set('No se pudo subir la imagen. Inténtalo de nuevo.');
                }
            });
        };
        reader.readAsDataURL(file);
    }

    removeImage(preguntaIndex: number): void {
        const control = this.preguntasArray.at(preguntaIndex);
        const newMap = new Map(this.questionImages());
        newMap.delete(control);
        this.questionImages.set(newMap);
        control.patchValue({ imagenUrl: null });
    }

    getQuestionImageData(preguntaIndex: number) {
        return this.questionImages().get(this.preguntasArray.at(preguntaIndex));
    }

    isUploadingImageFor(preguntaIndex: number): boolean {
        return this.questionImages().get(this.preguntasArray.at(preguntaIndex))?.uploading === true;
    }

    validarFormulario(): boolean {
        this.quizForm.markAllAsTouched();
        
        if (this.quizForm.invalid) {
            this.errorMessage.set('Por favor, completa todos los campos correctamente.');
            return false;
        }

        if (this.cantidadPreguntas === 0) {
            this.errorMessage.set('Agrega al menos una pregunta.');
            return false;
        }

        // Validate each question has at least 2 answers and one correct
        for (let i = 0; i < this.preguntasArray.length; i++) {
            const pregunta = this.preguntasArray.at(i);
            if (this.esSeparador(pregunta)) continue;

            const numero = this.obtenerNumeroPregunta(i);
            const respuestas = pregunta.get('respuestas') as FormArray;

            if (respuestas.length < 2) {
                this.errorMessage.set(`La pregunta ${numero} debe tener al menos 2 respuestas.`);
                return false;
            }

            const tieneCorrecta = respuestas.controls.some((r: AbstractControl) => r.get('esCorrecta')?.value === true);
            if (!tieneCorrecta) {
                this.errorMessage.set(`La pregunta ${numero} debe tener una respuesta correcta marcada.`);
                return false;
            }
        }

        // Una fase sin preguntas (dos separadores seguidos, o uno al final) no se puede publicar
        const controles = this.preguntasArray.controls;
        for (let i = 0; i < controles.length; i++) {
            if (!this.esSeparador(controles[i])) continue;
            const siguiente = controles[i + 1];
            if (!siguiente || this.esSeparador(siguiente)) {
                const nombre = (controles[i].get('nombre')?.value ?? '').trim();
                this.errorMessage.set(`La fase${nombre ? ' "' + nombre + '"' : ''} no tiene preguntas. Añade alguna o quita el separador.`);
                return false;
            }
        }

        return true;
    }

    private construirRequest(esBorrador: boolean): CreateQuizRequest {
        const formValue = this.quizForm.value as {
            nombre: string;
            esPublico: boolean;
            preguntas: PreguntaFormValue[];
        };

        const nombre = (formValue.nombre ?? '').trim();

        return {
            nombre: nombre || 'Borrador sin título',
            esPublico: formValue.esPublico ?? false,
            esBorrador,
            preguntas: this.aplanarPreguntas(formValue.preguntas)
        };
    }

    /**
     * Recorre la lista del builder: cada separador abre una fase nueva (un separador inicial solo
     * nombra la primera) y todas las preguntas hasta el siguiente separador la comparten.
     * Los separadores sin preguntas detrás no generan fase, para que la numeración sea consecutiva.
     */
    private aplanarPreguntas(items: PreguntaFormValue[]): CreateQuizRequest['preguntas'] {
        const resultado: CreateQuizRequest['preguntas'] = [];
        let fase = 1;
        let faseNombre: string | undefined;
        let faseColor: string | undefined;
        let preguntasEnFase = 0;

        for (const item of items) {
            if (item.tipo === 'separador') {
                if (preguntasEnFase > 0) {
                    fase++;
                    preguntasEnFase = 0;
                }
                faseNombre = (item.nombre ?? '').trim() || undefined;
                faseColor = esColorValido(item.color) ? item.color.toLowerCase() : undefined;
                continue;
            }

            preguntasEnFase++;
            resultado.push({
                numeroPregunta: resultado.length + 1,
                faseNumero: fase,
                faseNombre,
                faseColor,
                enunciado: item.enunciado ?? '',
                respuestas: item.respuestas.map((r: RespuestaFormValue) => ({
                    texto: r.texto ?? '',
                    esCorrecta: !!r.esCorrecta
                })),
                imagenUrl: item.imagenUrl || undefined,
                dificultad: item.dificultad || undefined
            });
        }

        return resultado;
    }

    private guardar(request: CreateQuizRequest) {
        const id = this.quizId();
        return id === null
            ? this.cuestionarioService.crearQuiz(request)
            : this.cuestionarioService.actualizarQuiz(id, request);
    }

    guardarBorrador(): void {
        this.enviarBorrador(false);
    }

    /** Autoguardado periódico: solo si hay cambios sin guardar. */
    private autoguardar(): void {
        if (this.quizForm.dirty) {
            this.enviarBorrador(true);
        }
    }

    private enviarBorrador(silencioso: boolean): void {
        if (this.savingDraft() || this.isLoading() || this.loadingQuiz()) return;
        this.savingDraft.set(true);
        if (!silencioso) {
            this.errorMessage.set(null);
        }

        this.guardar(this.construirRequest(true)).subscribe({
            next: (cuestionario) => {
                this.savingDraft.set(false);
                if (this.version() > 0) {
                    // Cuestionario publicado: el borrador va aparte, lo publicado no cambia
                    this.tieneBorrador.set(true);
                    this.borradorPendiente.set(null);
                    this.versiones.set(null);
                } else {
                    this.isDraft.set(true);
                }
                this.lastSavedAt.set(new Date());
                this.quizForm.markAsPristine();
                if (this.quizId() === null) {
                    this.quizId.set(cuestionario.id);
                    this.location.replaceState(`/cuestionarios/editar/${cuestionario.id}`);
                }
                if (!silencioso) {
                    this.successMessage.set('Borrador guardado.');
                    setTimeout(() => this.successMessage.set(null), 2500);
                }
            },
            error: (err) => {
                this.savingDraft.set(false);
                if (!silencioso) {
                    this.errorMessage.set(err.error?.message || 'No se pudo guardar el borrador.');
                }
            }
        });
    }

    onSubmit(): void {
        if (!this.validarFormulario()) {
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        const editando = this.isEdit();

        this.guardar(this.construirRequest(false)).subscribe({
            next: (cuestionario) => {
                this.isLoading.set(false);
                this.quizForm.markAsPristine();
                this.successMessage.set(this.esPublicado() ? `¡Publicada la versión ${cuestionario.version ?? ''}!` : (editando ? '¡Cuestionario publicado!' : '¡Cuestionario creado exitosamente!'));
                setTimeout(() => {
                    this.router.navigate(['/cuestionarios', cuestionario.id]);
                }, 1500);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(
                    err.error?.message || 'No se pudo guardar el cuestionario. Inténtalo de nuevo.'
                );
            }
        });
    }
}
