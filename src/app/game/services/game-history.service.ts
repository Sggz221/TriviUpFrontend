import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

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
  private authService = inject(AuthService);
  private apiUrl = '/api/game';

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  getHistory(): Observable<GameHistoryDto[]> {
    return this.http.get<GameHistoryDto[]>(`${this.apiUrl}/history`, {
      headers: this.getHeaders()
    });
  }

  getGameDetails(gameId: number): Observable<GameHistoryDto> {
    return this.http.get<GameHistoryDto>(`${this.apiUrl}/${gameId}`, {
      headers: this.getHeaders()
    });
  }
}
