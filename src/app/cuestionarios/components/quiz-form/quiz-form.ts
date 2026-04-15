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
            ])
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
                }))
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
