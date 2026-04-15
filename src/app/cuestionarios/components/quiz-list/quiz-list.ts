import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CuestionarioService } from '../../services/cuestionario.service';
import { Cuestionario } from '../../models/cuestionario.model';

@Component({
    selector: 'app-quiz-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './quiz-list.html',
    styleUrls: ['./quiz-list.css']
})
export class QuizListComponent implements OnInit {
    private cuestionarioService = inject(CuestionarioService);

    cuestionarios = signal<Cuestionario[]>([]);
    isLoading = signal(true);
    errorMessage = signal<string | null>(null);

    ngOnInit(): void {
        this.cargarQuizzes();
    }

    cargarQuizzes(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.cuestionarioService.obtenerMisQuizzes().subscribe({
            next: (quizzes) => {
                this.cuestionarios.set(quizzes);
                this.isLoading.set(false);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(
                    err.error?.message || 'No se pudieron cargar los cuestionarios.'
                );
            }
        });
    }

    eliminarQuiz(id: number, event: Event): void {
        event.stopPropagation();
        
        if (!confirm('¿Estás seguro de que quieres eliminar este cuestionario?')) {
            return;
        }

        this.cuestionarioService.eliminarQuiz(id).subscribe({
            next: () => {
                this.cuestionarios.update(quizzes => quizzes.filter(q => q.id !== id));
            },
            error: (err) => {
                this.errorMessage.set(
                    err.error?.message || 'No se pudo eliminar el cuestionario.'
                );
            }
        });
    }

    formatearFecha(fecha: string): string {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
}
