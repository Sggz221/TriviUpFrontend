import { Component, signal, inject, computed, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CuestionarioService } from '../../services/cuestionario.service';
import {
    Cuestionario, CreateQuizRequest, QuizVersion, BancoPregunta, BancoCategoria, Dificultad, Pregunta, TipoPregunta
} from '../../models/cuestionario.model';
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

interface PreguntaFormValue {
    tipo: TipoPregunta;
    dificultad?: Dificultad | null;
    enunciado: string;
    respuestas: RespuestaFormValue[];
    imagenUrl?: string | null;
}

/**
 * Fase del builder: agrupa sus preguntas. Es obligatoria (todo cuestionario tiene al menos una)
 * y es el sitio donde irá su configuración propia (p. ej. la pool de preguntas).
 */
interface FaseFormValue {
    /** Nombre libre; vacío = se muestra "Fase N". */
    nombre: string;
    /** Color #rrggbb, vacío = por defecto según el número de fase. */
    color: string;
    preguntas: PreguntaFormValue[];
}

type ImagenPregunta = { uploading: boolean; url: string | null; preview: string | null };

@Component({
    selector: 'app-quiz-form',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, RouterLink, AnswerShapeComponent, BancoPickerComponent,
        CategoriaSelectorComponent, DificultadSelectorComponent,
        CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder
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

    /** Fase en la que se abrió el panel del banco (null = cerrado). */
    bancoDestino = signal<AbstractControl | null>(null);

    /** Diálogo "Al banco": pregunta que se guarda y categoría elegida (existente o nueva). */
    dialogoBanco = signal<{
        pregunta: AbstractControl;
        categoriaId: number | null;
        categoriaNombre: string | null;
        guardando: boolean;
    } | null>(null);
    categoriasBanco = signal<BancoCategoria[]>([]);

    // Estado de las imágenes por pregunta. La clave es el control (no el índice) para que
    // insertar, mover o borrar preguntas no desincronice las imágenes.
    questionImages = signal<Map<AbstractControl, ImagenPregunta>>(new Map());

    quizForm: FormGroup;

    constructor() {
        this.quizForm = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(3)]],
            esPublico: [false],
            fases: this.fb.array([])
        });

        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            this.cargarQuiz(Number(idParam));
        } else {
            this.fasesArray.push(this.crearFase());
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
                this.fasesArray.push(this.crearFase());
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

    /** Agrupa las preguntas por su número de fase: cada grupo es una fase del builder. */
    private rellenarFormulario(quiz: Cuestionario): void {
        this.quizForm.patchValue({ nombre: quiz.nombre, esPublico: quiz.esPublico ?? false });
        this.fasesArray.clear();
        this.bancoDestino.set(null);
        const images = new Map<AbstractControl, ImagenPregunta>();

        const ordenadas = [...quiz.preguntas].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
        let faseAnterior: number | null = null;
        let fase: FormGroup | null = null;

        for (const p of ordenadas) {
            const numero = p.faseNumero ?? 1;
            if (fase === null || numero !== faseAnterior) {
                fase = this.crearFase(p.faseNombre ?? '', p.faseColor ?? '', false);
                this.fasesArray.push(fase);
                faseAnterior = numero;
            }

            const grupo = this.crearPregunta(p);
            this.preguntasDe(fase).push(grupo);
            if (p.imagenUrl) {
                images.set(grupo, { uploading: false, url: imageUrl(p.imagenUrl), preview: null });
            }
        }

        if (this.fasesArray.length === 0) {
            this.fasesArray.push(this.crearFase());
        }
        this.questionImages.set(images);
        this.quizForm.markAsPristine();
    }

    // ===== Estructura =====

    get fasesArray(): FormArray {
        return this.quizForm.get('fases') as FormArray;
    }

    preguntasDe(fase: number | AbstractControl): FormArray {
        const control = typeof fase === 'number' ? this.fasesArray.at(fase) : fase;
        return control.get('preguntas') as FormArray;
    }

    private crearFase(nombre = '', color = '', conPregunta = true): FormGroup {
        return this.fb.group({
            nombre: [nombre],
            color: [color],
            preguntas: this.fb.array(conPregunta ? [this.crearPregunta()] : [])
        });
    }

    private crearPregunta(datos?: Partial<Pick<Pregunta, 'enunciado' | 'imagenUrl' | 'dificultad' | 'tipo'>> & {
        respuestas?: { texto: string; esCorrecta: boolean }[];
    }, tipo: TipoPregunta = 'normal'): FormGroup {
        const respuestas = datos?.respuestas ?? [
            { texto: '', esCorrecta: false },
            { texto: '', esCorrecta: false }
        ];
        return this.fb.group({
            tipo: [(datos?.tipo ?? tipo) as TipoPregunta],
            dificultad: [(datos?.dificultad ?? null) as Dificultad | null],
            enunciado: [datos?.enunciado ?? '', Validators.required],
            respuestas: this.fb.array(respuestas.map(r => this.fb.group({
                texto: [r.texto, Validators.required],
                esCorrecta: [r.esCorrecta]
            }))),
            imagenUrl: [(datos?.imagenUrl ?? null) as string | null]
        });
    }

    /** Número de la pregunta en todo el cuestionario (la numeración sigue de una fase a otra). */
    numeroGlobal(faseIndex: number, preguntaIndex: number): number {
        let previas = 0;
        for (let i = 0; i < faseIndex; i++) {
            previas += this.preguntasDe(i).length;
        }
        return previas + preguntaIndex + 1;
    }

    /** Cierra el desplegable abierto (los menús de daisyUI se cierran al perder el foco). */
    cerrarMenu(): void {
        (document.activeElement as HTMLElement | null)?.blur();
    }

    // ===== Fases =====

    /** Añade una fase al final con una pregunta vacía y la lleva a la vista. */
    agregarFase(): void {
        this.fasesArray.push(this.crearFase());
        this.quizForm.markAsDirty();
        const index = this.fasesArray.length - 1;
        setTimeout(() => document.getElementById(`fase-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

    /** Quita una fase con sus preguntas; siempre debe quedar al menos una. */
    eliminarFase(index: number): void {
        this.cerrarMenu();
        if (this.fasesArray.length <= 1) return;

        const preguntas = this.preguntasDe(index);
        const conContenido = preguntas.controls.filter(p => !this.preguntaVacia(p)).length;
        if (conContenido > 0 &&
            !confirm(`¿Eliminar «${this.nombreFase(index)}» y sus ${preguntas.length} pregunta(s)?`)) {
            return;
        }

        const fase = this.fasesArray.at(index);
        if (this.bancoDestino() === fase) this.bancoDestino.set(null);
        const images = new Map(this.questionImages());
        preguntas.controls.forEach(p => images.delete(p));
        this.questionImages.set(images);
        this.fasesArray.removeAt(index);
        this.quizForm.markAsDirty();
    }

    moverFase(index: number, delta: -1 | 1): void {
        this.cerrarMenu();
        const destino = index + delta;
        if (destino < 0 || destino >= this.fasesArray.length) return;

        const control = this.fasesArray.at(index);
        this.fasesArray.removeAt(index);
        this.fasesArray.insert(destino, control);
        this.quizForm.markAsDirty();
    }

    /** Nombre visible de la fase: el elegido o "Fase N". */
    nombreFase(index: number): string {
        return (this.fasesArray.at(index).get('nombre')?.value ?? '').trim() || `Fase ${index + 1}`;
    }

    /** Color efectivo de la fase: el elegido o el de la paleta según su número. */
    colorFase(index: number): string {
        return colorDeFase(index + 1, this.fasesArray.at(index).get('color')?.value);
    }

    /** ¿La fase usa un color elegido a mano (no el de por defecto)? */
    tieneColorPropio(index: number): boolean {
        return esColorValido(this.fasesArray.at(index).get('color')?.value);
    }

    /** Fija el color de la fase; vacío vuelve al color por defecto. */
    aplicarColorFase(index: number, color: string): void {
        this.fasesArray.at(index).patchValue({ color: esColorValido(color) ? color.toLowerCase() : '' });
        this.quizForm.markAsDirty();
    }

    /** Aplica un atajo de taxonomía al nombre de la fase ("Ronda" pasa a "Ronda 2" según su posición). */
    aplicarPresetFase(index: number, preset: string): void {
        this.cerrarMenu();
        const nombre = preset === 'Ronda' ? `Ronda ${index + 1}` : preset;
        this.fasesArray.at(index).patchValue({ nombre });
        this.quizForm.markAsDirty();
    }

    // ===== Preguntas =====

    agregarPregunta(faseIndex: number, tipo: TipoPregunta = 'normal'): void {
        this.cerrarMenu();
        this.preguntasDe(faseIndex).push(this.crearPregunta(undefined, tipo));
        this.quizForm.markAsDirty();
    }

    /** Copia la pregunta (con su imagen) justo debajo de la original. */
    duplicarPregunta(faseIndex: number, preguntaIndex: number): void {
        const preguntas = this.preguntasDe(faseIndex);
        const original = preguntas.at(preguntaIndex);
        const valor = original.value as PreguntaFormValue;
        const copia = this.crearPregunta({
            ...valor,
            respuestas: valor.respuestas.map(r => ({ ...r }))
        });
        preguntas.insert(preguntaIndex + 1, copia);

        const imagen = this.questionImages().get(original);
        if (imagen?.url) {
            const images = new Map(this.questionImages());
            images.set(copia, { uploading: false, url: imagen.url, preview: null });
            this.questionImages.set(images);
        }
        this.quizForm.markAsDirty();
    }

    /** Elimina una pregunta; si la fase se queda vacía, muestra su estado vacío. */
    eliminarPregunta(faseIndex: number, preguntaIndex: number): void {
        const preguntas = this.preguntasDe(faseIndex);
        const control = preguntas.at(preguntaIndex);
        preguntas.removeAt(preguntaIndex);
        const images = new Map(this.questionImages());
        images.delete(control);
        this.questionImages.set(images);
        this.quizForm.markAsDirty();
    }

    /**
     * Sube (-1) o baja (+1) una pregunta dentro de su fase; desde el extremo de una fase pasa
     * al final de la anterior o al principio de la siguiente.
     */
    moverPregunta(faseIndex: number, preguntaIndex: number, delta: -1 | 1): void {
        const origen = this.preguntasDe(faseIndex);
        const control = origen.at(preguntaIndex);
        const destinoIndex = preguntaIndex + delta;

        if (destinoIndex >= 0 && destinoIndex < origen.length) {
            origen.removeAt(preguntaIndex);
            origen.insert(destinoIndex, control);
        } else {
            const otraFase = faseIndex + delta;
            if (otraFase < 0 || otraFase >= this.fasesArray.length) return;
            const destino = this.preguntasDe(otraFase);
            origen.removeAt(preguntaIndex);
            destino.insert(delta < 0 ? destino.length : 0, control);
        }
        this.quizForm.markAsDirty();
    }

    puedeSubir(faseIndex: number, preguntaIndex: number): boolean {
        return faseIndex > 0 || preguntaIndex > 0;
    }

    puedeBajar(faseIndex: number, preguntaIndex: number): boolean {
        return faseIndex < this.fasesArray.length - 1 || preguntaIndex < this.preguntasDe(faseIndex).length - 1;
    }

    /** Suelta una pregunta arrastrada: reordena dentro de la fase o la pasa a otra. */
    onDrop(event: CdkDragDrop<FormArray>): void {
        const origen = event.previousContainer.data;
        const destino = event.container.data;
        if (origen === destino && event.previousIndex === event.currentIndex) return;

        const control = origen.at(event.previousIndex);
        origen.removeAt(event.previousIndex);
        destino.insert(event.currentIndex, control);
        this.quizForm.markAsDirty();
    }

    esPulsador(pregunta: AbstractControl): boolean {
        return pregunta.get('tipo')?.value === 'pulsador';
    }

    cambiarTipo(pregunta: AbstractControl, tipo: TipoPregunta): void {
        pregunta.patchValue({ tipo });
        this.quizForm.markAsDirty();
    }

    /** Cambia la dificultad de una pregunta (volver a pulsar la activa la deja sin clasificar). */
    cambiarDificultad(pregunta: AbstractControl, dificultad: Dificultad | null): void {
        pregunta.patchValue({ dificultad });
        this.quizForm.markAsDirty();
    }

    private preguntaVacia(control: AbstractControl): boolean {
        const respuestas = control.get('respuestas') as FormArray;
        return !control.get('enunciado')?.value?.trim() &&
            !control.get('imagenUrl')?.value &&
            respuestas.controls.every(r => !r.get('texto')?.value?.trim());
    }

    // ===== Banco de preguntas =====

    abrirBanco(faseIndex: number): void {
        this.cerrarMenu();
        this.bancoDestino.set(this.fasesArray.at(faseIndex));
    }

    cerrarBanco(): void {
        this.bancoDestino.set(null);
    }

    /** Copia al final de la fase las preguntas elegidas en el banco (no quedan enlazadas). */
    agregarDesdeBanco(preguntas: BancoPregunta[]): void {
        const fase = this.bancoDestino();
        if (!fase) return;
        const destino = this.preguntasDe(fase);
        const images = new Map(this.questionImages());

        // Si la fase solo tiene la pregunta vacía inicial, se sustituye
        if (destino.length === 1 && this.preguntaVacia(destino.at(0))) {
            images.delete(destino.at(0));
            destino.clear();
        }

        for (const p of preguntas) {
            const grupo = this.crearPregunta({
                enunciado: p.enunciado,
                respuestas: p.respuestas,
                imagenUrl: p.imagenUrl ?? null,
                dificultad: p.dificultad ?? null
            });
            destino.push(grupo);
            if (p.imagenUrl) {
                images.set(grupo, { uploading: false, url: imageUrl(p.imagenUrl), preview: null });
            }
        }

        this.questionImages.set(images);
        this.quizForm.markAsDirty();
        this.bancoDestino.set(null);
        this.successMessage.set(`${preguntas.length} pregunta(s) añadida(s) desde el banco.`);
        setTimeout(() => this.successMessage.set(null), 3000);
    }

    /** Abre el diálogo para guardar la pregunta en el banco eligiendo (o creando) su categoría. */
    guardarEnBanco(pregunta: AbstractControl): void {
        if (!this.preguntaValidaParaBanco(pregunta)) {
            this.errorMessage.set('Completa la pregunta (enunciado, respuestas y una correcta) antes de guardarla en el banco.');
            return;
        }

        this.errorMessage.set(null);
        this.dialogoBanco.set({ pregunta, categoriaId: null, categoriaNombre: null, guardando: false });

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
        if (!dialogo || dialogo.guardando || !this.preguntaValidaParaBanco(dialogo.pregunta)) return;

        const control = dialogo.pregunta;
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

    private preguntaValidaParaBanco(control: AbstractControl): boolean {
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

    // ===== Respuestas =====

    respuestasDe(pregunta: AbstractControl): FormArray {
        return pregunta.get('respuestas') as FormArray;
    }

    agregarRespuesta(pregunta: AbstractControl): void {
        const respuestas = this.respuestasDe(pregunta);
        if (respuestas.length >= 4) {
            this.errorMessage.set('Máximo 4 respuestas por pregunta');
            return;
        }
        respuestas.push(this.fb.group({
            texto: ['', Validators.required],
            esCorrecta: [false]
        }));
    }

    eliminarRespuesta(pregunta: AbstractControl, respuesta: AbstractControl): void {
        const respuestas = this.respuestasDe(pregunta);
        if (respuestas.length <= 2) return;

        const index = respuestas.controls.indexOf(respuesta);
        if (index === -1) return;
        respuestas.removeAt(index);
        // Al quitar una respuesta se desmarca la correcta para evitar inconsistencias visuales
        respuestas.controls.forEach(r => r.patchValue({ esCorrecta: false }));
    }

    /** Marca una sola respuesta como correcta. */
    setRespuestaCorrecta(pregunta: AbstractControl, respuestaIndex: number): void {
        const respuestas = this.respuestasDe(pregunta);
        respuestas.controls.forEach((r, i) => r.patchValue({ esCorrecta: i === respuestaIndex }));
    }

    obtenerShapeRespuesta(index: number): ShapeType {
        const shapes: ShapeType[] = ['triangle', 'square', 'circle', 'pentagon'];
        return shapes[index] || 'triangle';
    }

    // ===== Imágenes =====

    onImageSelected(event: Event, control: AbstractControl): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.errorMessage.set('Por favor, selecciona una imagen válida (JPG, PNG, GIF o WebP)');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.errorMessage.set('La imagen debe ser menor de 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = e.target?.result as string;

            const newMap = new Map(this.questionImages());
            newMap.set(control, { uploading: true, url: null, preview });
            this.questionImages.set(newMap);

            this.cuestionarioService.subirImagenPregunta(file).subscribe({
                next: (response) => {
                    const updatedMap = new Map(this.questionImages());
                    updatedMap.set(control, { uploading: false, url: imageUrl(response.path), preview: null });
                    this.questionImages.set(updatedMap);

                    // Se guarda la ruta relativa en el formulario
                    control.patchValue({ imagenUrl: response.path });
                    this.quizForm.markAsDirty();
                },
                error: () => {
                    const updatedMap = new Map(this.questionImages());
                    updatedMap.delete(control);
                    this.questionImages.set(updatedMap);
                    this.errorMessage.set('No se pudo subir la imagen. Inténtalo de nuevo.');
                }
            });
        };
        reader.readAsDataURL(file);
    }

    removeImage(control: AbstractControl): void {
        const newMap = new Map(this.questionImages());
        newMap.delete(control);
        this.questionImages.set(newMap);
        control.patchValue({ imagenUrl: null });
        this.quizForm.markAsDirty();
    }

    getQuestionImageData(control: AbstractControl): ImagenPregunta | undefined {
        return this.questionImages().get(control);
    }

    // ===== Guardar y publicar =====

    validarFormulario(): boolean {
        this.quizForm.markAllAsTouched();

        if (this.quizForm.invalid) {
            this.errorMessage.set('Por favor, completa todos los campos correctamente.');
            return false;
        }

        if (this.fasesArray.length === 0) {
            this.errorMessage.set('Agrega al menos una fase.');
            return false;
        }

        for (let f = 0; f < this.fasesArray.length; f++) {
            const preguntas = this.preguntasDe(f);
            if (preguntas.length === 0) {
                this.errorMessage.set(`«${this.nombreFase(f)}» no tiene preguntas. Añade alguna o elimina la fase.`);
                return false;
            }

            for (let p = 0; p < preguntas.length; p++) {
                const numero = this.numeroGlobal(f, p);
                const respuestas = this.respuestasDe(preguntas.at(p));

                if (respuestas.length < 2) {
                    this.errorMessage.set(`La pregunta ${numero} debe tener al menos 2 respuestas.`);
                    return false;
                }

                if (!respuestas.controls.some(r => r.get('esCorrecta')?.value === true)) {
                    this.errorMessage.set(`La pregunta ${numero} debe tener una respuesta correcta marcada.`);
                    return false;
                }
            }
        }

        return true;
    }

    private construirRequest(esBorrador: boolean): CreateQuizRequest {
        const formValue = this.quizForm.value as {
            nombre: string;
            esPublico: boolean;
            fases: FaseFormValue[];
        };

        const nombre = (formValue.nombre ?? '').trim();

        return {
            nombre: nombre || 'Borrador sin título',
            esPublico: formValue.esPublico ?? false,
            esBorrador,
            preguntas: this.aplanarPreguntas(formValue.fases)
        };
    }

    /**
     * Pasa las fases del builder a la lista de preguntas de la API: cada pregunta lleva los datos
     * de su fase. Las fases vacías se omiten para que la numeración de fases sea consecutiva.
     */
    private aplanarPreguntas(fases: FaseFormValue[]): CreateQuizRequest['preguntas'] {
        const resultado: CreateQuizRequest['preguntas'] = [];
        let faseNumero = 0;

        for (const fase of fases) {
            if (fase.preguntas.length === 0) continue;
            faseNumero++;
            const faseNombre = (fase.nombre ?? '').trim() || undefined;
            const faseColor = esColorValido(fase.color) ? fase.color.toLowerCase() : undefined;

            for (const item of fase.preguntas) {
                resultado.push({
                    numeroPregunta: resultado.length + 1,
                    faseNumero,
                    faseNombre,
                    faseColor,
                    tipo: item.tipo ?? 'normal',
                    enunciado: item.enunciado ?? '',
                    respuestas: item.respuestas.map((r: RespuestaFormValue) => ({
                        texto: r.texto ?? '',
                        esCorrecta: !!r.esCorrecta
                    })),
                    imagenUrl: item.imagenUrl || undefined,
                    dificultad: item.dificultad || undefined
                });
            }
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
