import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from '../../models/game.models';
import { QrCodeComponent } from '../qr-code/qr-code.component';

@Component({
    selector: 'app-game-lobby',
    standalone: true,
    imports: [CommonModule, QrCodeComponent],
    templateUrl: './game-lobby.component.html',
    styleUrl: './game-lobby.component.scss'
})
export class GameLobbyComponent {
    @Input() set roomCode(value: string) {
        this.roomCodeSignal.set(value);
    }
    @Input() set players(value: Player[]) {
        this.playersSignal.set(value);
    }
    @Input() set isOwner(value: boolean) {
        this.isOwnerSignal.set(value);
    }
    @Input() set myUserId(value: number) {
        this.myUserIdSignal.set(value);
    }
    @Input() set myUsername(value: string) {
        this.myUsernameSignal.set(value);
    }
    @Input() set quizTitle(value: string) {
        this.quizTitleSignal.set(value);
    }
    @Input() set isStarting(value: boolean) {
        this.isStartingSignal.set(value);
    }

    @Output() startGame = new EventEmitter<void>();
    @Output() leaveGame = new EventEmitter<void>();
    @Output() kickPlayer = new EventEmitter<number>();

    roomCodeSignal = signal<string>('');
    playersSignal = signal<Player[]>([]);
    isOwnerSignal = signal<boolean>(false);
    myUserIdSignal = signal<number>(0);
    myUsernameSignal = signal<string>('');
    quizTitleSignal = signal<string>('');
    isStartingSignal = signal<boolean>(false);

    playerCount = computed(() => this.playersSignal().length);

    /**
     * Generate the QR code URL for joining the game
     * Uses current host (hostname + port) to work both locally and on mobile
     */
    generateQrCodeUrl(): string {
        const port = window.location.port ? `:${window.location.port}` : '';
        const baseUrl = `${window.location.protocol}//${window.location.hostname}${port}`;
        return `${baseUrl}/game/${this.roomCodeSignal()}`;
    }

    /**
     * Get the full room URL for display
     */
    getRoomUrl(): string {
        return this.generateQrCodeUrl();
    }

    /**
     * Copy room code to clipboard
     */
    async copyRoomCode(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.roomCodeSignal());
        } catch (err) {
            console.error('Failed to copy room code:', err);
        }
    }

    onStartGame(): void {
        this.startGame.emit();
    }

    onLeaveGame(): void {
        this.leaveGame.emit();
    }

    onKickPlayer(playerId: number): void {
        this.kickPlayer.emit(playerId);
    }
}
