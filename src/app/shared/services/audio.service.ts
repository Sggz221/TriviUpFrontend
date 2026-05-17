import { Injectable, signal } from '@angular/core';

export type SoundType = 'correct' | 'wrong' | 'turnStart' | 'gameOver';

@Injectable({
    providedIn: 'root'
})
export class AudioService {
    private audioContext: AudioContext | null = null;
    private isMuted = signal(this.loadMutedPreference());

    private loadMutedPreference(): boolean {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('soundMuted') === 'true';
        }
        return false;
    }

    private saveMutedPreference(muted: boolean): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('soundMuted', muted.toString());
        }
    }

    get muted() {
        return this.isMuted.asReadonly();
    }

    toggleMute(): void {
        const newValue = !this.isMuted();
        this.isMuted.set(newValue);
        this.saveMutedPreference(newValue);
    }

    setMuted(muted: boolean): void {
        this.isMuted.set(muted);
        this.saveMutedPreference(muted);
    }

    private getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        return this.audioContext;
    }

    private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue: number = 0.3): void {
        if (this.isMuted()) return;

        try {
            const ctx = this.getAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

            gainNode.gain.setValueAtTime(gainValue, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (error) {
            console.warn('[AudioService] Error playing tone:', error);
        }
    }

    playCorrect(): void {
        // Pleasant ascending tones for correct answer
        this.playTone(523.25, 0.1, 'sine', 0.25); // C5
        setTimeout(() => this.playTone(659.25, 0.15, 'sine', 0.25), 100); // E5
        setTimeout(() => this.playTone(783.99, 0.2, 'sine', 0.2), 200); // G5
    }

    playWrong(): void {
        // Descending tone for wrong answer
        this.playTone(300, 0.15, 'sawtooth', 0.15);
        setTimeout(() => this.playTone(200, 0.3, 'sawtooth', 0.1), 150);
    }

    playTurnStart(): void {
        // Short notification sound
        this.playTone(440, 0.08, 'square', 0.15);
        setTimeout(() => this.playTone(880, 0.1, 'square', 0.12), 80);
    }

    playGameOver(): void {
        // Victory fanfare-like sound
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.2), i * 150);
        });
    }
}
