import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameHistoryService, GameHistoryDto } from '../../services/game-history.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-game-details',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="details-wrapper">
      <div class="details-container">
        <div class="details-header">
          <a routerLink="/game/history" class="btn btn-ghost text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Historial
          </a>
        </div>

        @if (loading()) {
          <div class="loading-state">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-white/80">Cargando detalles...</p>
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
              <h1 class="text-white text-3xl font-bold mb-4">{{ game()!.quizTitle }}</h1>
              <div class="game-info-bar text-white/70">
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
              <h2 class="text-xl text-white font-semibold mb-4">Clasificación Final</h2>
              <div class="results-list">
                @for (player of game()!.playerResults; track player.userId; let i = $index) {
                  <div class="result-item" [class.winner]="$index === 0">
                    <div class="rank" [class.winner-rank]="$index === 0">{{ player.rank }}</div>
                    <div class="player-info">
                      <span class="username text-white">{{ player.username }}</span>
                      @if (player.userId === game()!.ownerId) {
                        <span class="owner-badge">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-1" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5.16 6.08L7 4.24l1.84 1.84A3.99 3.99 0 0012 5.5c.93 0 1.78.32 2.46.84L15.84 4.5l1.84 1.84-1.84 1.84A3.99 3.99 0 0018.5 12c0 .93-.32 1.78-.84 2.46L19.16 16l-1.84 1.84-1.84-1.84A3.99 3.99 0 0012 18.5c-.93 0-1.78-.32-2.46-.84L8.16 19.5l-1.84-1.84 1.84-1.84A3.99 3.99 0 005.5 12c0-.93.32-1.78.84-2.46L4.5 8.16 6.34 6.32l-1.18-1.24zM12 14.5l3.5-3.5-1.06-1.06L12 12.38l-2.44-2.44-1.06 1.06L12 14.5z"/>
                          </svg>
                          Anfitrión
                        </span>
                      }
                    </div>
                    <div class="score text-primary">{{ player.finalScore }} pts</div>
                    <div class="stats">
                      <span class="correct text-success font-semibold">{{ player.correctAnswers }} correctas</span>
                      <span class="percentage text-white/60 text-sm">{{ getPercentage(player) }}%</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .details-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, var(--base-100) 0%, var(--base-200) 50%, var(--base-300) 100%);
      padding: 2rem;
    }

    .details-container {
      max-width: 800px;
      margin: 0 auto;
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
      font-size: 0.9rem;
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
      background: rgba(255, 255, 255, 0.08);
      border-radius: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .result-item.winner {
      background: linear-gradient(135deg, rgba(42, 114, 155, 0.25), rgba(199, 87, 186, 0.15), rgba(237, 83, 129, 0.15));
      border: 2px solid transparent;
      background-clip: padding-box;
      position: relative;
    }

    .result-item.winner::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 0.75rem;
      padding: 2px;
      background: linear-gradient(135deg, #2a729a, #c757ba, #ed5381);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
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
      color: white;
      flex-shrink: 0;
    }

    .rank.winner-rank {
      background: linear-gradient(135deg, #2a729a 0%, #c757ba 50%, #ed5381 100%);
      color: white;
    }

    .player-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .username {
      font-weight: 600;
      font-size: 1.1rem;
    }

    .owner-badge {
      font-size: 0.8rem;
      color: var(--primary);
      display: flex;
      align-items: center;
    }

    .score {
      font-weight: 700;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-size: 0.85rem;
      flex-shrink: 0;
      padding-right: 0.25rem;
      border-radius: 0;
    }

    .correct {
      font-weight: 600;
      white-space: nowrap;
      border-radius: 0;
    }

    .percentage {
      font-size: 0.8rem;
      white-space: nowrap;
      border-radius: 0;
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
