import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizzesPublicService } from '../../services/quizzes-public.service';
import { CuestionarioPublico, PaginatedQuizzesResponse } from '../../models/cuestionario-publico.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
    selector: 'app-quizzes-public',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, NavbarComponent],
    templateUrl: './quizzes-public.component.html',
    styleUrls: ['./quizzes-public.component.scss']
})
export class QuizzesPublicComponent implements OnInit {
    private quizzesPublicService = inject(QuizzesPublicService);

    quizzes = signal<CuestionarioPublico[]>([]);
    isLoading = signal(true);
    errorMessage = signal<string | null>(null);

    currentPage = signal(1);
    pageSize = signal(10);
    totalCount = signal(0);
    totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

    searchTerm = signal('');
    private searchSubject = new Subject<string>();

    ngOnInit(): void {
        this.setupSearchDebounce();
        this.loadQuizzes();
    }

    private setupSearchDebounce(): void {
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(search => {
                this.isLoading.set(true);
                this.currentPage.set(1);
                return this.quizzesPublicService.getQuizzesPublic(search, 1, this.pageSize());
            })
        ).subscribe({
            next: (response) => this.handleResponse(response),
            error: (err) => this.handleError(err)
        });
    }

    onSearchInput(value: string): void {
        this.searchTerm.set(value);
        this.searchSubject.next(value);
    }

    loadQuizzes(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.quizzesPublicService.getQuizzesPublic(
            this.searchTerm(),
            this.currentPage(),
            this.pageSize()
        ).subscribe({
            next: (response) => this.handleResponse(response),
            error: (err) => this.handleError(err)
        });
    }

    private handleResponse(response: PaginatedQuizzesResponse): void {
        const quizzesWithLikedState = response.quizzes.map(q => ({
            ...q,
            userHasLiked: false
        }));
        this.quizzes.set(quizzesWithLikedState);
        this.totalCount.set(response.totalCount);
        this.isLoading.set(false);
    }

    private handleError(err: any): void {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'No se pudieron cargar los cuestionarios públicos.');
    }

    goToPage(page: number): void {
        if (page < 1 || page > this.totalPages() || this.isLoading()) {
            return;
        }
        this.currentPage.set(page);
        this.loadQuizzes();
    }

    nextPage(): void {
        this.goToPage(this.currentPage() + 1);
    }

    prevPage(): void {
        this.goToPage(this.currentPage() - 1);
    }

    likeQuiz(quiz: CuestionarioPublico, event: Event): void {
        event.stopPropagation();
        event.preventDefault();

        if (quiz.userHasLiked) {
            // Toggle: quitar like - llamar al backend
            this.quizzesPublicService.unlikeQuiz(quiz.id).subscribe({
                next: (response) => {
                    this.quizzes.update(quizzes =>
                        quizzes.map(q => q.id === quiz.id ? { ...q, likes: response.count, userHasLiked: false } : q)
                    );
                },
                error: (err) => {
                    console.error('Error al quitar like:', err);
                }
            });
        } else {
            // Dar like - enviar petición al backend
            this.quizzesPublicService.likeQuiz(quiz.id).subscribe({
                next: (response) => {
                    this.quizzes.update(quizzes =>
                        quizzes.map(q => q.id === quiz.id ? { ...q, likes: response.count, userHasLiked: true } : q)
                    );
                },
                error: (err) => {
                    console.error('Error al dar like:', err);
                }
            });
        }
    }

    recordVisit(quiz: CuestionarioPublico): void {
        this.quizzesPublicService.recordVisit(quiz.id).subscribe({
            next: (response) => {
                this.quizzes.update(quizzes =>
                    quizzes.map(q => q.id === quiz.id ? { ...q, visitas: response.count } : q)
                );
            },
            error: (err) => {
                console.error('Error al registrar visita:', err);
            }
        });
    }

    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    private colors = [
        { bg: '#f87171', text: '#ffffff' }, // red
        { bg: '#fb923c', text: '#ffffff' }, // orange
        { bg: '#fbbf24', text: '#000000' }, // amber
        { bg: '#34d399', text: '#000000' }, // emerald
        { bg: '#60a5fa', text: '#ffffff' }, // blue
        { bg: '#a78bfa', text: '#ffffff' }, // violet
        { bg: '#f472b6', text: '#ffffff' }, // pink
    ];

    getCardBg(username: string): string {
        const index = username.charCodeAt(0) % this.colors.length;
        return this.colors[index].bg;
    }

    getCardTextColor(username: string): string {
        const index = username.charCodeAt(0) % this.colors.length;
        return this.colors[index].text;
    }

    getVisiblePages(): (number | string)[] {
        const total = this.totalPages();
        const current = this.currentPage();
        const pages: (number | string)[] = [];

        if (total <= 7) {
            for (let i = 1; i <= total; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (current > 3) {
                pages.push('...');
            }

            const start = Math.max(2, current - 1);
            const end = Math.min(total - 1, current + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (current < total - 2) {
                pages.push('...');
            }

            pages.push(total);
        }

        return pages;
    }
}
