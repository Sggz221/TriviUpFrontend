import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameSignalrService } from '../../services/game-signalr.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
    selector: 'app-join-room',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './join-room.html',
    styleUrl: './join-room.scss'
})
export class JoinRoomComponent {
    private router = inject(Router);
    gameSignalrService = inject(GameSignalrService);
    private authService = inject(AuthService);

    roomCode = signal<string>('');
    username = signal<string>('');
    isLoading = signal<boolean>(false);
    errorMessage = signal<string | null>(null);

    get isLoggedIn(): boolean {
        return this.authService.isLoggedIn();
    }

    get user() {
        return this.authService.getUser();
    }

    onRoomCodeChange(value: string): void {
        // Automatically uppercase and limit to 6 characters
        this.roomCode.set(value.toUpperCase().slice(0, 6));
    }

    onUsernameChange(value: string): void {
        this.username.set(value);
    }

    async onJoin(): Promise<void> {
        const code = this.roomCode().trim();
        const username = this.username().trim();

        // Validation
        if (!code || code.length < 4) {
            this.errorMessage.set('Introduce un código de sala válido (mínimo 4 caracteres)');
            return;
        }

        if (!this.isLoggedIn && (!username || username.length < 2)) {
            this.errorMessage.set('El nombre de usuario debe tener al menos 2 caracteres');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);

        try {
            if (this.isLoggedIn) {
                // Logged in user: connect with token then join
                const user = this.user!;
                const token = this.authService.getToken()!;

                await this.gameSignalrService.connect(token);
                await this.gameSignalrService.joinGame(code, user.id, user.username);
            } else {
                // Anonymous user: generate random ID and connect anonymously
                const anonymousUserId = Math.floor(Math.random() * 1000000);
                await this.gameSignalrService.connectAnonymously(anonymousUserId, username);
                await this.gameSignalrService.joinGame(code);
            }

            // Navigate to the game room
            this.router.navigate(['/game', code]);
        } catch (error) {
            console.error('[JoinRoom] Error joining room:', error);
            this.errorMessage.set('No se pudo unir a la sala. Verifica el código e inténtalo de nuevo.');
        } finally {
            this.isLoading.set(false);
        }
    }

    goBack(): void {
        this.router.navigate(['/']);
    }
}