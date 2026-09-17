import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameHistoryService, GameHistoryDto } from '../../services/game-history.service';
import { DatePipe } from '@angular/common';
import { GameScoreboardComponent } from '../../components/game-scoreboard/game-scoreboard.component';

@Component({
  selector: 'app-game-details',
  standalone: true,
  imports: [RouterLink, DatePipe, GameScoreboardComponent],
  template: `
    <div class="details-wrapper">
      <div class="details-container">
        <div class="details-header">
          <a routerLink="/game/history" class="btn btn-ghost" style="color: var(--base-content);">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Historial
          </a>
        </div>

        @if (loading()) {
          <div class="loading-state">
            <span class="loading loading-spinner loading-lg" style="color: var(--primary);"></span>
            <p style="color: var(--base-content); opacity: 0.8;">Cargando detalles...</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <div class="alert alert-error">
              <span>{{ error() }}</span>
            </div>
          </div>
        } @else if (game()) {
          <div class="details-panel">
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

            <app-game-scoreboard
              [playerResults]="game()!.playerResults"
              [quizTitle]="game()!.quizTitle"
              headline="Clasificación Final"
              [durationLabel]="getDuration()"
              [ownerId]="game()!.ownerId"
            />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .details-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, var(--base-100) 0%, var(--base-200) 50%, var(--base-300) 100%);
      padding: 2rem 1rem 3rem;
      box-sizing: border-box;
    }

    .details-container {
      max-width: 44rem;
      margin: 0 auto;
    }

    .details-header {
      margin-bottom: 1.5rem;
    }

    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .details-panel {
      width: 100%;
      padding: 1.25rem 1rem 1.5rem;
      background-color: var(--base-200);
      border: 1px solid var(--neutral);
      border-radius: 1.25rem;
      box-sizing: border-box;
    }

    .game-info-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem 1.5rem;
      margin-bottom: 0.5rem;
      justify-content: center;
      color: var(--base-content);
      opacity: 0.7;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
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
      error: () => {
        this.error.set('Error al cargar los detalles');
        this.loading.set(false);
      }
    });
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
