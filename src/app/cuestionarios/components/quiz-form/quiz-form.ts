import { Component, signal, inject, computed, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CuestionarioService } from '../../services/cuestionario.service';
import { Cuestionario, CreateQuizRequest, QuizVersion } from '../../models/cuestionario.model';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { AnswerShapeComponent, ShapeType } from '../../../shared/components/answer-shape/answer-shape';

interface RespuestaFormValue {
    texto: string;
    esCorrecta: boolean;
}

interface PreguntaFormValue {
    enunciado: string;
    respuestas: RespuestaFormValue[];
    imagenUrl?: string;
}

@Component({
    selector: 'app-quiz-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, AnswerShapeComponent],
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

    // Track image uploads per question
    questionImages = signal<Map<number, { uploading: boolean; url: string | null; preview: string | null }>>(new Map());
    uploadingQuestionIndex = signal<number | null>(null);

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
        const images = new Map<number, { uploading: boolean; url: string | null; preview: string | null }>();

        [...quiz.preguntas]
            .sort((a, b) => a.numeroPregunta - b.numeroPregunta)
            .forEach((p, index) => {
                this.preguntasArray.push(this.fb.group({
                    enunciado: [p.enunciado, Validators.required],
                    respuestas: this.fb.array(p.respuestas.map(r => this.fb.group({
                        texto: [r.texto, Validators.required],
                        esCorrecta: [r.esCorrecta]
                    }))),
                    imagenUrl: [p.imagenUrl ?? null]
                }));
                if (p.imagenUrl) {
                    images.set(index, { uploading: false, url: imageUrl(p.imagenUrl), preview: null });
                }
            });

        if (this.preguntasArray.length === 0) {
            this.agregarPregunta();
        }
        this.questionImages.set(images);
        this.quizForm.markAsPristine();
    }

    get preguntasArray(): FormArray {
        return this.quizForm.get('preguntas') as FormArray;
    }

    agregarPregunta(): void {
        const preguntaGroup = this.fb.group({
            enunciado: ['', Validators.required],
            respuestas: this.fb.array([
                this.fb.group({ texto: ['', Validators.required], esCorrecta: [false] }),
                this.fb.group({ texto: ['', Validators.required], esCorrecta: [false] })
            ]),
            imagenUrl: [null as string | null]
        });
        this.preguntasArray.push(preguntaGroup);
    }

    eliminarPregunta(index: number): void {
        if (this.preguntasArray.length > 1) {
            this.preguntasArray.removeAt(index);
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

    obtenerNumeroPregunta(index: number): number {
        return index + 1;
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
            newMap.set(preguntaIndex, { uploading: true, url: null, preview });
            this.questionImages.set(newMap);
            this.uploadingQuestionIndex.set(preguntaIndex);

            // Upload immediately
            this.cuestionarioService.subirImagenPregunta(file).subscribe({
                next: (response) => {
                    const updatedMap = new Map(this.questionImages());
                    updatedMap.set(preguntaIndex, { uploading: false, url: imageUrl(response.path), preview: null });
                    this.questionImages.set(updatedMap);
                    this.uploadingQuestionIndex.set(null);

                    // Store the path (relative URL) in the form
                    this.preguntasArray.at(preguntaIndex).patchValue({ imagenUrl: response.path });
                    this.quizForm.markAsDirty();
                },
                error: (err) => {
                    const updatedMap = new Map(this.questionImages());
                    updatedMap.delete(preguntaIndex);
                    this.questionImages.set(updatedMap);
                    this.uploadingQuestionIndex.set(null);
                    this.errorMessage.set('No se pudo subir la imagen. Inténtalo de nuevo.');
                }
            });
        };
        reader.readAsDataURL(file);
    }

    removeImage(preguntaIndex: number): void {
        const newMap = new Map(this.questionImages());
        newMap.delete(preguntaIndex);
        this.questionImages.set(newMap);
        this.preguntasArray.at(preguntaIndex).patchValue({ imagenUrl: null });
    }

    getQuestionImageData(preguntaIndex: number) {
        return this.questionImages().get(preguntaIndex);
    }

    isUploadingImageFor(preguntaIndex: number): boolean {
        return this.uploadingQuestionIndex() === preguntaIndex;
    }

    validarFormulario(): boolean {
        this.quizForm.markAllAsTouched();
        
        if (this.quizForm.invalid) {
            this.errorMessage.set('Por favor, completa todos los campos correctamente.');
            return false;
        }

        if (this.preguntasArray.length === 0) {
            this.errorMessage.set('Agrega al menos una pregunta.');
            return false;
        }

        // Validate each question has at least 2 answers and one correct
        for (let i = 0; i < this.preguntasArray.length; i++) {
            const pregunta = this.preguntasArray.at(i);
            const respuestas = pregunta.get('respuestas') as FormArray;
            
            if (respuestas.length < 2) {
                this.errorMessage.set(`La pregunta ${i + 1} debe tener al menos 2 respuestas.`);
                return false;
            }

            const tieneCorrecta = respuestas.controls.some((r: AbstractControl) => r.get('esCorrecta')?.value === true);
            if (!tieneCorrecta) {
                this.errorMessage.set(`La pregunta ${i + 1} debe tener una respuesta correcta marcada.`);
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
            preguntas: formValue.preguntas.map((pregunta: PreguntaFormValue, index: number) => ({
                numeroPregunta: index + 1,
                enunciado: pregunta.enunciado ?? '',
                respuestas: pregunta.respuestas.map((r: RespuestaFormValue) => ({
                    texto: r.texto ?? '',
                    esCorrecta: !!r.esCorrecta
                })),
                imagenUrl: pregunta.imagenUrl || undefined
            }))
        };
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
