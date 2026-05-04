import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CuestionarioService } from '../../services/cuestionario.service';
import { CreateQuizRequest } from '../../models/cuestionario.model';

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
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './quiz-form.html',
    styleUrls: ['./quiz-form.css']
})
export class QuizFormComponent {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private cuestionarioService = inject(CuestionarioService);

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
            preguntas: this.fb.array([])
        });

        // Add initial question
        this.agregarPregunta();
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
        respuestas.push(this.fb.group({
            texto: ['', Validators.required],
            esCorrecta: [false]
        }));
    }

    eliminarRespuesta(preguntaIndex: number, respuestaIndex: number): void {
        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;
        if (respuestas.length > 2) {
            respuestas.removeAt(respuestaIndex);
        }
    }

    setRespuestaCorrecta(preguntaIndex: number, respuestaIndex: number): void {
        const pregunta = this.preguntasArray.at(preguntaIndex);
        const respuestas = pregunta.get('respuestas') as FormArray;
        
        // Uncheck all others first
        for (let i = 0; i < respuestas.length; i++) {
            respuestas.at(i).patchValue({ esCorrecta: i === respuestaIndex });
        }
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
                    updatedMap.set(preguntaIndex, { uploading: false, url: response.url, preview: null });
                    this.questionImages.set(updatedMap);
                    this.uploadingQuestionIndex.set(null);

                    // Store the path (relative URL) in the form
                    this.preguntasArray.at(preguntaIndex).patchValue({ imagenUrl: response.path });
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

    onSubmit(): void {
        if (!this.validarFormulario()) {
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        const formValue = this.quizForm.value as {
            nombre: string;
            preguntas: PreguntaFormValue[];
        };

        const request: CreateQuizRequest = {
            nombre: formValue.nombre,
            preguntas: formValue.preguntas.map((pregunta: PreguntaFormValue, index: number) => ({
                numeroPregunta: index + 1,
                enunciado: pregunta.enunciado,
                respuestas: pregunta.respuestas.map((r: RespuestaFormValue) => ({
                    texto: r.texto,
                    esCorrecta: r.esCorrecta
                })),
                imagenUrl: pregunta.imagenUrl || undefined
            }))
        };

        this.cuestionarioService.crearQuiz(request).subscribe({
            next: (cuestionario) => {
                this.isLoading.set(false);
                this.successMessage.set('¡Cuestionario creado exitosamente!');
                setTimeout(() => {
                    this.router.navigate(['/cuestionarios', cuestionario.id]);
                }, 1500);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(
                    err.error?.message || 'No se pudo crear el cuestionario. Inténtalo de nuevo.'
                );
            }
        });
    }
}
