import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameHistoryService, GameHistoryDto } from '../../services/game-history.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-game-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="history-container">
      <div class="history-header">
        <h1 class="text-3xl font-bold gradient-text">Historial de Partidas</h1>
        <a routerLink="/" class="btn btn-ghost">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </a>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <span class="loading loading-spinner loading-lg"></span>
          <p>Cargando historial...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <div class="alert alert-error">
            <span>{{ error() }}</span>
          </div>
        </div>
      } @else if (histories().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <h2>No hay partidas en el historial</h2>
          <p>¡Juega alguna partida para ver tu historial aquí!</p>
          <a routerLink="/quizzes/public" class="btn btn-primary mt-4">
            Ver Cuestionarios Públicos
          </a>
        </div>
      } @else {
        <div class="history-list">
          @for (history of histories(); track history.gameId) {
            <a [routerLink]="['/game/history', history.gameId]" class="history-card">
              <div class="history-info">
                <h3 class="history-title">{{ history.quizTitle }}</h3>
                <div class="history-meta">
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
                  <span class="score-value">{{ history.playerResults[0].finalScore }}</span>
                  <span class="score-label">pts</span>
                }
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .history-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .gradient-text {
      background: linear-gradient(135deg, #2a729a 0%, #c757ba 50%, #ed5381 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .loading-state, .error-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      color: var(--base-content);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
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
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1rem;
      transition: all 0.3s ease;
      text-decoration: none;
      color: inherit;
    }

    .history-card:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateX(4px);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .history-info {
      flex: 1;
    }

    .history-title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
      color: var(--base-content);
    }

    .history-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      opacity: 0.7;
      color: var(--base-content);
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
      opacity: 0.7;
      color: var(--base-content);
    }

    .arrow-icon {
      opacity: 0.5;
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
