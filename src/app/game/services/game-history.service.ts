import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HistoryPlayerResultDto {
  userId: number;
  username: string;
  finalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  rank: number;
}

export interface GameHistoryDto {
  gameId: number;
  quizId: number;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  ownerId: number;
  playerResults: HistoryPlayerResultDto[];
}

@Injectable({ providedIn: 'root' })
export class GameHistoryService {
  private http = inject(HttpClient);
  private apiUrl = '/api/game';

  getHistory(): Observable<GameHistoryDto[]> {
    return this.http.get<GameHistoryDto[]>(`${this.apiUrl}/history`);
  }

  getGameDetails(gameId: number): Observable<GameHistoryDto> {
    return this.http.get<GameHistoryDto>(`${this.apiUrl}/${gameId}`);
  }
}
