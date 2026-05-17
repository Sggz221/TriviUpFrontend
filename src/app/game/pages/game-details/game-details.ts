import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameHistoryService, GameHistoryDto } from '../../services/game-history.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-game-details',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="details-container">
      <div class="details-header">
        <a routerLink="/game/history" class="btn btn-ghost">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al Historial
        </a>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <span class="loading loading-spinner loading-lg"></span>
          <p>Cargando detalles...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <div class="alert alert-error">
            <span>{{ error() }}</span>
          </div>
        </div>
      } @else if (game()) {
        <div class="game-details">
          <div class="game-title-section">
            <h1 class="gradient-text">{{ game()!.quizTitle }}</h1>
            <div class="game-info-bar">
              <span class="info-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ game()!.endedAt | date:'dd/MM/yyyy HH:mm' }}
              </span>
              <span class="info-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ getDuration() }}
              </span>
            </div>
          </div>

          <div class="results-section">
            <h2>Clasificación Final</h2>
            <div class="results-list">
              @for (player of game()!.playerResults; track player.userId; let i = $index) {
                <div class="result-item" [class.winner]="$index === 0">
                  <div class="rank">{{ player.rank }}</div>
                  <div class="player-info">
                    <span class="username">{{ player.username }}</span>
                    @if (player.userId === game()!.ownerId) {
                      <span class="owner-badge">👑 Anfitrión</span>
                    }
                  </div>
                  <div class="score">{{ player.finalScore }} pts</div>
                  <div class="stats">
                    <span class="correct">{{ player.correctAnswers }} correctas</span>
                    <span class="percentage">{{ getPercentage(player) }}%</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .details-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .details-header {
      margin-bottom: 2rem;
    }

    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      color: var(--base-content);
    }

    .gradient-text {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #2a729a 0%, #c757ba 50%, #ed5381 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .game-title-section {
      margin-bottom: 2rem;
    }

    .game-info-bar {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.75rem;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--base-content);
      opacity: 0.8;
      font-size: 0.9rem;
    }

    .results-section h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--base-content);
    }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .result-item.winner {
      background: linear-gradient(135deg, rgba(42, 114, 155, 0.2), rgba(199, 87, 186, 0.2), rgba(237, 83, 129, 0.2));
      border: 2px solid;
      border-image: linear-gradient(135deg, #2a729a, #c757ba, #ed5381) 1;
    }

    .rank {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--base-content);
    }

    .result-item.winner .rank {
      background: linear-gradient(135deg, #2a729a, #c757ba, #ed5381);
      color: white;
    }

    .player-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .username {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--base-content);
    }

    .owner-badge {
      font-size: 0.8rem;
      background: linear-gradient(135deg, #2a729a, #c757ba, #ed5381);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .score {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--primary);
    }

    .stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-size: 0.85rem;
    }

    .correct {
      color: var(--success);
      font-weight: 600;
    }

    .percentage {
      color: var(--base-content);
      opacity: 0.7;
      font-size: 0.8rem;
    }
  `]
})
export class GameDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(GameHistoryService);

  game = signal<GameHistoryDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    const gameId = this.route.snapshot.paramMap.get('gameId');
    if (gameId) {
      this.loadGame(+gameId);
    }
  }

  private loadGame(gameId: number) {
    this.service.getGameDetails(gameId).subscribe({
      next: (data) => {
        this.game.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar los detalles');
        this.loading.set(false);
      }
    });
  }

  getPercentage(player: any): number {
    const total = player.correctAnswers + player.wrongAnswers;
    return total > 0 ? Math.round((player.correctAnswers / total) * 100) : 0;
  }

  getDuration(): string {
    const game = this.game();
    if (!game) return '';
    const start = new Date(game.startedAt);
    const end = new Date(game.endedAt);
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  }
}
