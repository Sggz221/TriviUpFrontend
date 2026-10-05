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
        if (this.isMuted() || this.sfxVolumeSignal() === 0) return;

        try {
            const ctx = this.getAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

            gainNode.gain.setValueAtTime(gainValue * this.sfxVolumeSignal(), ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (error) {
            console.warn('[AudioService] Error playing tone:', error);
        }
    }

    /** Clic corto de la ruleta al pasar el puntero por cada hueco. */
    playRuletaTick(): void {
        this.playTone(1400, 0.03, 'square', 0.06);
    }

    /** Golpe final al detenerse la ruleta. */
    playRuletaStop(): void {
        this.playTone(220, 0.25, 'triangle', 0.3);
        setTimeout(() => this.playTone(440, 0.3, 'sine', 0.2), 90);
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

    /** Carta quemándose: chisporroteo (clics agudos al azar) sobre un soplo grave que se apaga. */
    playBurn(): void {
        this.playTone(90, 0.9, 'sawtooth', 0.08);
        for (let i = 0; i < 14; i++) {
            setTimeout(() => this.playTone(1200 + Math.random() * 2200, 0.02, 'square', 0.05), 40 + Math.random() * 900);
        }
    }

    /** Tono de llamada de teléfono: dos pitidos dobles ("brrr-brrr") al empezar la llamada. */
    playCallRing(): void {
        [0, 120, 600, 720].forEach(at => {
            setTimeout(() => {
                this.playTone(440, 0.1, 'sine', 0.2);
                this.playTone(480, 0.1, 'sine', 0.2);
            }, at);
        });
    }

    /** Sorpresa al cambiar la pregunta de un rival: barrido que sube y "traqueteo" de dados. */
    playReroll(): void {
        [220, 277.18, 349.23, 440, 554.37, 698.46].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.09, 'square', 0.12), i * 55);
        });
        [0, 1, 2, 3].forEach(i => {
            setTimeout(() => this.playTone(1800 - i * 200, 0.03, 'square', 0.07), 40 + i * 80);
        });
        // Remate: golpe grave y acorde brillante
        setTimeout(() => this.playTone(130.81, 0.35, 'sawtooth', 0.22), 380);
        setTimeout(() => this.playTone(523.25, 0.4, 'triangle', 0.2), 400);
        setTimeout(() => this.playTone(783.99, 0.4, 'triangle', 0.16), 400);
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

    // ============ Música de fondo (canal independiente de los efectos) ============

    private static readonly MUSIC_URL = '/audio/music/TriviUp_BG_Music.ogg';
    /**
     * Puntos del bucle, en segundos: el archivo tiene ~0,78 s de silencio al principio y ~0,94 s al
     * final, así que se salta del último sonido al primero. Medidos sobre TriviUp_BG_Music.ogg;
     * hay que actualizarlos si se cambia el archivo.
     */
    private static readonly MUSIC_LOOP_START_S = 0.78;
    private static readonly MUSIC_LOOP_END_S = 338.83;
    /** Cada cuánto se comprueba si se ha llegado al final del bucle. */
    private static readonly MUSIC_LOOP_CHECK_MS = 30;
    /** Volumen base de la música; queda por debajo de los efectos. */
    private static readonly MUSIC_VOLUME = 0.35;
    /** Con un comodín bloqueante, la música baja a esta fracción y se "tapa" con un paso bajo. */
    private static readonly MUFFLED_GAIN = 0.4;
    private static readonly MUFFLED_CUTOFF_HZ = 500;
    private static readonly OPEN_CUTOFF_HZ = 20000;
    /** Constante de tiempo (s) de las transiciones de volumen y filtro: tarda ~3x en asentarse. */
    private static readonly MUSIC_SMOOTHING_S = 0.15;

    private musicMutedSignal = signal(this.loadFlag('musicMuted'));
    /** Volumen elegido por el jugador (0-1), por encima del volumen base de cada canal. */
    private musicVolumeSignal = signal(this.loadVolume('musicVolume'));
    private sfxVolumeSignal = signal(this.loadVolume('sfxVolume'));
    /** Se reproduce en streaming (no se decodifica entera: serían ~120 MB de memoria en el móvil). */
    private musicElement: HTMLAudioElement | null = null;
    private musicGain: GainNode | null = null;
    private musicFilter: BiquadFilterNode | null = null;
    private musicLoopTimer: ReturnType<typeof setInterval> | null = null;
    private musicStopTimer: ReturnType<typeof setTimeout> | null = null;
    private musicWanted = false;
    private musicMuffled = false;
    private unlockListenersAdded = false;

    get musicMuted() {
        return this.musicMutedSignal.asReadonly();
    }

    get musicVolume() {
        return this.musicVolumeSignal.asReadonly();
    }

    get sfxVolume() {
        return this.sfxVolumeSignal.asReadonly();
    }

    setMusicVolume(volume: number): void {
        this.musicVolumeSignal.set(AudioService.clampVolume(volume));
        this.saveVolume('musicVolume', this.musicVolumeSignal());
        this.applyMusicState();
    }

    setSfxVolume(volume: number): void {
        this.sfxVolumeSignal.set(AudioService.clampVolume(volume));
        this.saveVolume('sfxVolume', this.sfxVolumeSignal());
    }

    toggleMusicMute(): void {
        this.setMusicMuted(!this.musicMutedSignal());
    }

    setMusicMuted(muted: boolean): void {
        this.musicMutedSignal.set(muted);
        this.saveFlag('musicMuted', muted);
        this.applyMusicState();
    }

    /** Empieza la música en bucle (idempotente). Los navegadores solo la dejan sonar tras un gesto del usuario. */
    startMusic(): void {
        if (typeof window === 'undefined') return;
        this.musicWanted = true;
        if (this.musicStopTimer) {
            clearTimeout(this.musicStopTimer);
            this.musicStopTimer = null;
        }

        const element = this.ensureMusicGraph();
        if (element.paused) {
            if (element.currentTime < AudioService.MUSIC_LOOP_START_S) {
                element.currentTime = AudioService.MUSIC_LOOP_START_S;
            }
            this.tryPlayMusic();
        }
        this.startLoopWatcher();
        this.applyMusicState();
    }

    /** Para la música con un fundido corto. */
    stopMusic(): void {
        this.musicWanted = false;
        this.musicMuffled = false;
        const element = this.musicElement;
        if (!element || element.paused) {
            this.stopLoopWatcher();
            return;
        }

        this.applyMusicState();
        this.musicStopTimer = setTimeout(() => {
            this.musicStopTimer = null;
            element.pause();
            element.currentTime = AudioService.MUSIC_LOOP_START_S;
            this.stopLoopWatcher();
        }, 600);
    }

    /**
     * Tapa la música mientras dura algo bloqueante (ruleta, llamada): baja el volumen y cierra un
     * filtro paso bajo, como al pausar en muchos juegos. Las transiciones son suaves.
     */
    setMusicMuffled(muffled: boolean): void {
        this.musicMuffled = muffled;
        this.applyMusicState();
    }

    private static clampVolume(volume: number): number {
        return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    }

    private loadVolume(key: string): number {
        if (typeof localStorage === 'undefined') return 1;
        const stored = localStorage.getItem(key);
        return stored === null ? 1 : AudioService.clampVolume(Number(stored));
    }

    private saveVolume(key: string, value: number): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value.toString());
        }
    }

    private loadFlag(key: string): boolean {
        return typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'true';
    }

    private saveFlag(key: string, value: boolean): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value.toString());
        }
    }

    /** Crea (una vez) el elemento de audio y su cadena: elemento → paso bajo → volumen → salida. */
    private ensureMusicGraph(): HTMLAudioElement {
        if (this.musicElement) return this.musicElement;

        const ctx = this.getAudioContext();
        const element = new Audio(AudioService.MUSIC_URL);
        element.preload = 'auto';
        // Si el navegador llega al final real (pestaña en segundo plano sin temporizadores), se vuelve a empezar
        element.addEventListener('ended', () => {
            element.currentTime = AudioService.MUSIC_LOOP_START_S;
            if (this.musicWanted) this.tryPlayMusic();
        });

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = AudioService.OPEN_CUTOFF_HZ;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(element).connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        this.musicElement = element;
        this.musicFilter = filter;
        this.musicGain = gain;
        return element;
    }

    private tryPlayMusic(): void {
        const element = this.musicElement;
        if (!element) return;
        void this.getAudioContext().resume().catch(() => { /* espera al primer gesto */ });
        element.play().catch(() => this.unlockOnGesture());
    }

    /** Salta del último sonido al primero sin esperar al silencio final del archivo. */
    private startLoopWatcher(): void {
        if (this.musicLoopTimer) return;
        this.musicLoopTimer = setInterval(() => {
            const element = this.musicElement;
            if (element && !element.paused && element.currentTime >= AudioService.MUSIC_LOOP_END_S) {
                element.currentTime = AudioService.MUSIC_LOOP_START_S;
            }
        }, AudioService.MUSIC_LOOP_CHECK_MS);
    }

    private stopLoopWatcher(): void {
        if (!this.musicLoopTimer) return;
        clearInterval(this.musicLoopTimer);
        this.musicLoopTimer = null;
    }

    /** Lleva volumen y filtro al estado que toque (muteada, tapada o normal) con una transición suave. */
    private applyMusicState(): void {
        if (!this.musicGain || !this.musicFilter) return;
        const ctx = this.getAudioContext();
        const volume = this.musicMutedSignal() || !this.musicWanted
            ? 0
            : AudioService.MUSIC_VOLUME * this.musicVolumeSignal() * (this.musicMuffled ? AudioService.MUFFLED_GAIN : 1);
        const cutoff = this.musicMuffled ? AudioService.MUFFLED_CUTOFF_HZ : AudioService.OPEN_CUTOFF_HZ;
        this.musicGain.gain.setTargetAtTime(volume, ctx.currentTime, AudioService.MUSIC_SMOOTHING_S);
        this.musicFilter.frequency.setTargetAtTime(cutoff, ctx.currentTime, AudioService.MUSIC_SMOOTHING_S);
    }

    /** El navegador bloquea el audio hasta el primer gesto del usuario: se reintenta en cuanto ocurre. */
    private unlockOnGesture(): void {
        if (this.unlockListenersAdded) return;

        this.unlockListenersAdded = true;
        const events = ['pointerdown', 'keydown', 'touchend'];
        const unlock = () => {
            events.forEach(e => window.removeEventListener(e, unlock));
            this.unlockListenersAdded = false;
            if (this.musicWanted) this.tryPlayMusic();
        };
        events.forEach(e => window.addEventListener(e, unlock));
    }
}
