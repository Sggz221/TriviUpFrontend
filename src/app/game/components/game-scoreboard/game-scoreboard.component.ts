import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ScoreboardPlayer {
  userId: number;
  username: string;
  rank: number;
  finalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  correctPercentage?: number;
}

@Component({
  selector: 'app-game-scoreboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-scoreboard.component.html',
  styleUrl: './game-scoreboard.component.scss'
})
export class GameScoreboardComponent {
  private playersSignal = signal<ScoreboardPlayer[]>([]);
  private ownerIdSignal = signal<number | null>(null);

  @Input() set playerResults(value: ScoreboardPlayer[] | null | undefined) {
    this.playersSignal.set(value ?? []);
  }

  @Input() quizTitle = '';
  @Input() headline = '¡Partida Terminada!';
  @Input() totalQuestions: number | null = null;
  @Input() durationLabel: string | null = null;

  @Input() set ownerId(value: number | null | undefined) {
    this.ownerIdSignal.set(value ?? null);
  }

  sortedPlayers = computed(() =>
    [...this.playersSignal()].sort((a, b) => a.rank - b.rank || b.finalScore - a.finalScore)
  );

  first = computed(() => this.sortedPlayers().find(p => p.rank === 1) ?? this.sortedPlayers()[0] ?? null);
  second = computed(() => this.sortedPlayers().find(p => p.rank === 2) ?? null);
  third = computed(() => this.sortedPlayers().find(p => p.rank === 3) ?? null);

  restPlayers = computed(() => this.sortedPlayers().filter(p => p.rank >= 4));

  podiumCount = computed(() => {
    let n = 0;
    if (this.first()) n++;
    if (this.second()) n++;
    if (this.third()) n++;
    return n;
  });

  metaLabel = computed(() => {
    const parts: string[] = [];
    if (this.totalQuestions != null) {
      parts.push(`${this.totalQuestions} preguntas`);
    }
    if (this.durationLabel) {
      parts.push(this.durationLabel);
    }
    return parts.join(' · ');
  });

  percentage(player: ScoreboardPlayer): number {
    if (player.correctPercentage != null) {
      return Math.round(player.correctPercentage);
    }
    const total = player.correctAnswers + player.wrongAnswers;
    return total > 0 ? Math.round((player.correctAnswers / total) * 100) : 0;
  }

  isOwner(player: ScoreboardPlayer): boolean {
    const ownerId = this.ownerIdSignal();
    return ownerId != null && player.userId === ownerId;
  }
}
