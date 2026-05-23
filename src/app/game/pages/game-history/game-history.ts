import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameHistoryService, GameHistoryDto } from '../../services/game-history.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-game-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="history-wrapper">
      <div class="history-container">
        <div class="history-header">
          <h1 class="text-3xl font-bold text-white">Historial de Partidas</h1>
          <a routerLink="/" class="btn btn-ghost text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver
          </a>
        </div>

        @if (loading()) {
          <div class="loading-state">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-white/80">Cargando historial...</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <div class="alert alert-error">
              <span>{{ error() }}</span>
            </div>
          </div>
        } @else if (histories().length === 0) {
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
            <h2 class="text-xl text-white font-semibold">No hay partidas en el historial</h2>
            <p class="text-white/70">¡Juega alguna partida para ver tu historial aquí!</p>
            <a routerLink="/quizzes/public" class="btn btn-primary mt-4">
              Ver Cuestionarios Públicos
            </a>
          </div>
        } @else {
          <div class="history-list">
            @for (history of histories(); track history.gameId) {
              <a [routerLink]="['/game/history', history.gameId]" class="history-card">
                <div class="history-info">
                  <h3 class="history-title text-white">{{ history.quizTitle }}</h3>
                  <div class="history-meta text-white/60">
                    <span class="history-date">
                      {{ history.endedAt | date:'dd/MM/yyyy HH:mm' }}
                    </span>
                    <span class="history-players">
                      {{ history.playerResults.length }} jugadores
                    </span>
                  </div>
                </div>
                <div class="history-score">
                  @if (history.playerResults.length > 0) {
                    <span class="score-value text-white">{{ history.playerResults[0].finalScore }}</span>
                    <span class="score-label text-white/60">pts</span>
                  }
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 arrow-icon text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .history-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, var(--base-100) 0%, var(--base-200) 50%, var(--base-300) 100%);
      padding: 2rem;
    }

    .history-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .loading-state, .error-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 1rem;
      color: var(--primary);
    }

    .empty-state h2 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .history-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 1rem;
      transition: all 0.3s ease;
      text-decoration: none;
    }

    .history-card:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateX(4px);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .history-info {
      flex: 1;
    }

    .history-title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
    }

    .history-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
    }

    .history-score {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
    }

    .score-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
    }

    .score-label {
      font-size: 0.85rem;
    }

    .arrow-icon {
      transition: transform 0.2s ease;
    }

    .history-card:hover .arrow-icon {
      transform: translateX(4px);
    }
  `]
})
export class GameHistoryComponent implements OnInit {
  private service = inject(GameHistoryService);

  histories = signal<GameHistoryDto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadHistory();
  }

  private loadHistory() {
    this.service.getHistory().subscribe({
      next: (data) => {
        this.histories.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar el historial');
        this.loading.set(false);
      }
    });
  }
}
