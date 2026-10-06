import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioService } from '../../../shared/services/audio.service';
import { countUp, prefersReducedMotion } from '../../utils/count-up';
import { confettiPieces } from '../../utils/confetti';

export interface ScoreboardPlayer {
  userId: number;
  username: string;
  rank: number;
  finalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  correctPercentage?: number;
}

/**
 * Pasos de la revelación dramática, en orden: titular, resto de la clasificación (del último al 4º), podio en
 * incógnita ("?" y sin colores), los finalistas a la vez (sin decir en qué puesto), redoble, cada uno sube a su
 * puesto (3º, 2º, 1º) y el ganador a pantalla completa. Cada paso dura lo indicado antes del siguiente.
 */
type RevealKey = 'headline' | `rest:${number}` | 'mystery' | 'finalists' | 'drum' | 'podium' | 'winner' | 'done';

const PASO_MS: Record<string, number> = {
  headline: 1300,
  rest: 550,
  mystery: 1300,
  finalists: 2300,
  drum: 2600,
  podium: 2600,
  winner: 2300
};
const CONTEO_MS = 900;
/** Retraso con el que sube cada puesto al revelar el podio (3º, luego 2º, luego 1º). */
const SUBIDA_MS: Record<number, number> = { 3: 0, 2: 550, 1: 1100 };

@Component({
  selector: 'app-game-scoreboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-scoreboard.component.html',
  styleUrl: './game-scoreboard.component.scss'
})
export class GameScoreboardComponent implements OnInit, OnDestroy {
  private audio = inject(AudioService);

  private playersSignal = signal<ScoreboardPlayer[]>([]);
  private ownerIdSignal = signal<number | null>(null);

  @Input() set playerResults(value: ScoreboardPlayer[] | null | undefined) {
    this.playersSignal.set(value ?? []);
  }

  @Input() quizTitle = '';
  @Input() headline = '¡Partida Terminada!';
  @Input() totalQuestions: number | null = null;
  @Input() durationLabel: string | null = null;
  /** Revela los puestos poco a poco (último → primero) con sonido. Sin él, todo aparece a la vez (historial). */
  @Input() dramatic = false;

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

  // ---- Revelación dramática ----
  private sequence: RevealKey[] = [];
  /** Índice del paso actual dentro de `sequence`; Infinity = todo visible. */
  private step = signal(Number.POSITIVE_INFINITY);
  /** Avance 0..1 del conteo de puntos de cada jugador (sin entrada = ya contado). */
  private scoreProgress = signal<ReadonlyMap<number, number>>(new Map());
  /** Nombre del ganador a pantalla completa, tras subir al podio. */
  winnerSplash = signal(false);

  /** Finalistas del podio en orden alfabético: se muestran juntos sin desvelar quién queda en qué puesto. */
  finalists = computed(() =>
    [this.first(), this.second(), this.third()]
      .filter((p): p is ScoreboardPlayer => !!p)
      .sort((a, b) => a.username.localeCompare(b.username, 'es')));

  /** Retraso (s) con el que sube al podio cada puesto. */
  riseDelay(place: number): string {
    return `${(SUBIDA_MS[place] ?? 0) / 1000}s`;
  }
  readonly confettiPieces = confettiPieces(60);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private cancels: (() => void)[] = [];

  /** Hay una revelación en curso (para el botón "Saltar"). */
  revealing = computed(() => this.step() < this.sequence.length - 1);
  current = computed<RevealKey | null>(() => this.sequence[this.step()] ?? null);

  ngOnInit(): void {
    if (!this.dramatic || prefersReducedMotion() || this.sortedPlayers().length === 0) return;

    this.sequence = [
      'headline',
      ...[...this.restPlayers()].reverse().map(p => `rest:${p.userId}` as RevealKey),
      'mystery',
      'finalists',
      'drum',
      'podium',
      'winner',
      'done'
    ];
    this.scoreProgress.set(new Map(this.sortedPlayers().map(p => [p.userId, 0])));
    this.goTo(0);
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  shown(key: RevealKey): boolean {
    const index = this.sequence.indexOf(key);
    return index < 0 || index <= this.step();
  }

  shownRest(player: ScoreboardPlayer): boolean {
    return this.shown(`rest:${player.userId}`);
  }

  displayScore(player: ScoreboardPlayer): number {
    const progress = this.scoreProgress().get(player.userId) ?? 1;
    return Math.round(player.finalScore * progress);
  }

  skip(): void {
    this.clearTimers();
    this.winnerSplash.set(false);
    this.scoreProgress.set(new Map());
    this.step.set(Number.POSITIVE_INFINITY);
  }

  private goTo(index: number): void {
    this.step.set(index);
    const key = this.sequence[index];
    if (!key || key === 'done') return;

    const restIndex = key.startsWith('rest:') ? this.sequence.indexOf(key) - 1 : 0;
    switch (key) {
      case 'headline':
        this.audio.playImpact(0.9);
        break;
      case 'mystery':
        this.audio.playWhoosh();
        break;
      case 'finalists':
        this.audio.playImpact(0.8);
        break;
      case 'drum':
        this.audio.playDrumroll(PASO_MS['drum']);
        break;
      case 'podium':
        // Cada uno sube a su puesto con su golpe, y su puntuación cuenta hacia arriba al llegar
        ([[3, this.third()], [2, this.second()], [1, this.first()]] as const).forEach(([place, player]) => {
          if (!player) return;
          const at = SUBIDA_MS[place];
          this.audio.playImpact(place === 1 ? 1 : place === 2 ? 0.8 : 0.6, at / 1000);
          this.later(() => this.countScore(player), at + 300);
        });
        break;
      case 'winner':
        this.audio.playFanfare();
        this.winnerSplash.set(true);
        this.later(() => this.winnerSplash.set(false), PASO_MS['winner']);
        break;
      default: {
        // Resto de la clasificación: tic que sube de tono según se acerca al podio
        this.audio.playTick(0.8 + restIndex * 0.08);
        const player = this.restPlayers().find(p => `rest:${p.userId}` === key) ?? null;
        this.countScore(player);
      }
    }

    const wait = PASO_MS[key.startsWith('rest:') ? 'rest' : key] ?? 1000;
    this.later(() => this.goTo(index + 1), wait);
  }

  private countScore(player: ScoreboardPlayer | null): void {
    if (!player) return;
    this.cancels.push(countUp(CONTEO_MS, p =>
      this.scoreProgress.update(m => new Map(m).set(player.userId, p))));
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.cancels.forEach(cancel => cancel());
    this.cancels = [];
  }

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
