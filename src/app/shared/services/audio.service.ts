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

    /** Salida común de los efectos: pasa por un compresor suave para que las capas no saturen. */
    private sfxBus: DynamicsCompressorNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;

    private canPlaySfx(): boolean {
        return typeof window !== 'undefined' && !this.isMuted() && this.sfxVolumeSignal() > 0;
    }

    private getSfxBus(ctx: AudioContext): AudioNode {
        if (!this.sfxBus) {
            this.sfxBus = ctx.createDynamicsCompressor();
            this.sfxBus.threshold.value = -12;
            this.sfxBus.ratio.value = 4;
            this.sfxBus.connect(ctx.destination);
        }
        return this.sfxBus;
    }

    /**
     * Nota sintetizada programada en el reloj de audio (sin setTimeout).
     * `at` es el desfase en segundos desde ahora; `slideTo` hace un barrido de frecuencia hasta el final.
     */
    private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue: number = 0.3,
                     opts: { at?: number; slideTo?: number; attack?: number; vibrato?: number; detune?: number } = {}): void {
        if (!this.canPlaySfx()) return;

        try {
            const ctx = this.getAudioContext();
            void ctx.resume().catch(() => { /* espera al primer gesto */ });
            const start = ctx.currentTime + (opts.at ?? 0);
            const end = start + duration;
            const attack = Math.min(opts.attack ?? 0.005, duration / 2);
            const peak = gainValue * this.sfxVolumeSignal();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.type = type;
            oscillator.detune.value = opts.detune ?? 0;
            oscillator.frequency.setValueAtTime(frequency, start);
            if (opts.slideTo) oscillator.frequency.exponentialRampToValueAtTime(opts.slideTo, end);

            if (opts.vibrato) {
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 6;
                lfoGain.gain.value = opts.vibrato;
                lfo.connect(lfoGain).connect(oscillator.frequency);
                lfo.start(start);
                lfo.stop(end);
            }

            gainNode.gain.setValueAtTime(0.0001, start);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + attack);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

            oscillator.connect(gainNode).connect(this.getSfxBus(ctx));
            oscillator.start(start);
            oscillator.stop(end + 0.02);
        } catch (error) {
            console.warn('[AudioService] Error playing tone:', error);
        }
    }

    /** Ráfaga de ruido filtrado: golpes, soplidos, redobles y brillos metálicos. */
    private playNoise(duration: number, filterFreq: number, gainValue: number,
                      opts: { at?: number; type?: BiquadFilterType; sweepTo?: number; q?: number; attack?: number } = {}): void {
        if (!this.canPlaySfx()) return;

        try {
            const ctx = this.getAudioContext();
            if (!this.noiseBuffer) {
                const length = ctx.sampleRate * 2;
                this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
                const data = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
            }
            const start = ctx.currentTime + (opts.at ?? 0);
            const end = start + duration;
            const attack = Math.min(opts.attack ?? 0.003, duration / 2);

            const source = ctx.createBufferSource();
            source.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = opts.type ?? 'bandpass';
            filter.Q.value = opts.q ?? 1;
            filter.frequency.setValueAtTime(filterFreq, start);
            if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, end);

            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(0.0001, start);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(gainValue * this.sfxVolumeSignal(), 0.0002), start + attack);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

            source.connect(filter).connect(gainNode).connect(this.getSfxBus(ctx));
            source.start(start, Math.random());
            source.stop(end + 0.02);
        } catch (error) {
            console.warn('[AudioService] Error playing noise:', error);
        }
    }

    /** Clic corto de la ruleta al pasar el puntero por cada hueco. */
    playRuletaTick(): void {
        this.playTone(1400, 0.03, 'square', 0.06);
        this.playNoise(0.02, 4000, 0.05, { type: 'highpass' });
    }

    /** Golpe final al detenerse la ruleta. */
    playRuletaStop(): void {
        this.playImpact(0.8);
        this.playTone(440, 0.3, 'triangle', 0.2, { at: 0.09 });
        this.playTone(659.25, 0.4, 'triangle', 0.16, { at: 0.09 });
    }

    /** Acierto: arpegio brillante con chispa de ruido y nota final sostenida. */
    playCorrect(): void {
        [523.25, 659.25, 783.99].forEach((f, i) => {
            this.playTone(f, 0.14, 'square', 0.1, { at: i * 0.08 });
            this.playTone(f, 0.18, 'triangle', 0.18, { at: i * 0.08 });
        });
        this.playTone(1046.5, 0.5, 'triangle', 0.2, { at: 0.24, vibrato: 6 });
        this.playTone(1046.5, 0.5, 'square', 0.06, { at: 0.24, detune: 8 });
        this.playNoise(0.25, 8000, 0.08, { at: 0.24, type: 'highpass' });
    }

    /** Fallo: zumbido de concurso que cae, con golpe sordo. */
    playWrong(): void {
        this.playTone(220, 0.45, 'sawtooth', 0.14, { slideTo: 110 });
        this.playTone(233, 0.45, 'sawtooth', 0.12, { slideTo: 116 });
        this.playImpact(0.6);
    }

    /** Carta quemándose: chisporroteo (clics agudos al azar) sobre un soplo grave que se apaga. */
    playBurn(): void {
        this.playNoise(0.9, 600, 0.12, { type: 'lowpass', sweepTo: 200, attack: 0.1 });
        for (let i = 0; i < 14; i++) {
            this.playTone(1200 + Math.random() * 2200, 0.02, 'square', 0.05, { at: 0.04 + Math.random() * 0.9 });
        }
    }

    /** Comodín de la llamada: melodía corta de móvil (~1,5 s) con vibrato. */
    playCallRing(): void {
        const E6 = 1318.5, D6 = 1174.7, Fs5 = 740, Gs5 = 830.6, Cs6 = 1108.7, B5 = 987.8, D5 = 587.3, E5 = 659.3;
        const melody: [number, number][] = [
            [E6, 0.12], [D6, 0.12], [Fs5, 0.24], [Gs5, 0.24],
            [Cs6, 0.12], [B5, 0.12], [D5, 0.24], [E5, 0.36],
        ];
        let t = 0;
        for (const [freq, len] of melody) {
            this.playTone(freq, len * 0.9, 'square', 0.07, { at: t, vibrato: 4 });
            this.playTone(freq, len * 0.9, 'triangle', 0.14, { at: t });
            t += len * 0.85;
        }
    }

    /** Sorpresa al cambiar la pregunta de un rival: barrido que sube y "traqueteo" de dados. */
    playReroll(): void {
        [220, 277.18, 349.23, 440, 554.37, 698.46].forEach((freq, i) => this.playTone(freq, 0.09, 'square', 0.12, { at: i * 0.055 }));
        [0, 1, 2, 3].forEach(i => this.playNoise(0.03, 2500 + i * 300, 0.12, { at: 0.04 + i * 0.08, q: 6 }));
        this.playImpact(0.8, 0.38);
        this.playTone(523.25, 0.4, 'triangle', 0.2, { at: 0.4 });
        this.playTone(783.99, 0.4, 'triangle', 0.16, { at: 0.4 });
    }

    /** Empieza tu turno: soplido rápido y doble nota ascendente. */
    playTurnStart(): void {
        this.playWhoosh();
        this.playTone(440, 0.08, 'square', 0.14, { at: 0.12 });
        this.playTone(880, 0.16, 'square', 0.12, { at: 0.2 });
        this.playTone(880, 0.2, 'triangle', 0.14, { at: 0.2 });
    }

    playGameOver(): void {
        this.playFanfare();
    }

    /** Apuesta: caja registradora ("cha-ching"). */
    playMoney(): void {
        // "cha": cajón metálico
        this.playNoise(0.08, 3000, 0.25, { q: 2 });
        this.playTone(180, 0.06, 'square', 0.1);
        // "ching": dos campanas agudas con armónicos inarmónicos
        [[2093, 0.12], [2637, 0.2]].forEach(([f, at]) => {
            this.playTone(f, 0.6, 'sine', 0.18, { at });
            this.playTone(f * 2.76, 0.4, 'sine', 0.06, { at });
            this.playTone(f * 5.4, 0.2, 'sine', 0.03, { at });
        });
        this.playNoise(0.3, 9000, 0.05, { at: 0.12, type: 'highpass' });
    }

    /** Apuesta ganada: lluvia de monedas que suben. */
    playCoinsWin(): void {
        [988, 1319, 1568, 1976, 2349, 2637].forEach((f, i) => {
            this.playTone(f, 0.12, 'square', 0.06, { at: i * 0.07 });
            this.playTone(f * 1.5, 0.18, 'sine', 0.1, { at: i * 0.07 + 0.03 });
        });
    }

    /** Apuesta perdida: "womp womp" descendente. */
    playLose(): void {
        [[392, 0], [370, 0.3], [349, 0.6]].forEach(([f, at]) =>
            this.playTone(f, 0.28, 'sawtooth', 0.1, { at, slideTo: f * 0.94, vibrato: 3 }));
        this.playTone(330, 0.7, 'sawtooth', 0.1, { at: 0.9, slideTo: 262, vibrato: 8 });
    }

    /** Soplido rápido (entradas de banner, robo). */
    playWhoosh(at = 0): void {
        this.playNoise(0.35, 400, 0.18, { at, sweepTo: 4000, q: 1.5, attack: 0.15 });
    }

    /** Golpe grave con chasquido; `strength` 0-1. */
    playImpact(strength = 1, at = 0): void {
        this.playTone(120, 0.35, 'sine', 0.45 * strength, { at, slideTo: 40 });
        this.playNoise(0.12, 1200, 0.3 * strength, { at, type: 'lowpass' });
        this.playNoise(0.04, 5000, 0.12 * strength, { at, type: 'highpass' });
    }

    /** Redoble de tambor con crescendo durante `ms`. */
    playDrumroll(ms = 1800): void {
        const total = ms / 1000;
        const hits = Math.floor(total / 0.045);
        for (let i = 0; i < hits; i++) {
            const k = i / hits;
            this.playNoise(0.05, 1800, 0.05 + k * 0.2, { at: i * 0.045, q: 0.8 });
        }
        this.playTone(80, total, 'sine', 0.15, { attack: total * 0.9 });
    }

    /** Fanfarria de trompetas (sierras desafinadas) para el ganador. */
    playFanfare(): void {
        const chord = (freqs: number[], at: number, len: number, g = 0.07) => freqs.forEach(f => {
            this.playTone(f, len, 'sawtooth', g, { at, detune: -7, attack: 0.02 });
            this.playTone(f, len, 'sawtooth', g, { at, detune: 7, attack: 0.02 });
        });
        chord([392, 523.25], 0, 0.12);
        chord([392, 523.25], 0.15, 0.12);
        chord([392, 523.25], 0.3, 0.12);
        chord([523.25, 659.25, 783.99], 0.45, 0.4);
        chord([466.16, 587.33, 698.46], 0.9, 0.3);
        chord([523.25, 659.25, 783.99, 1046.5], 1.2, 1.2, 0.08);
        this.playImpact(1, 0.45);
        this.playNoise(1.4, 7000, 0.06, { at: 1.2, type: 'highpass', attack: 0.05 });
    }

    /** Tic de reloj o de revelación; `pitch` sube la altura. */
    playTick(pitch = 1): void {
        this.playTone(900 * pitch, 0.05, 'square', 0.08);
        this.playNoise(0.03, 3000 * pitch, 0.08, { q: 4 });
    }

    /** Cuenta atrás del pulsador (3, 2, 1): pitido grave de semáforo de carreras. */
    playCountdownBeep(): void {
        this.playTone(440, 0.22, 'square', 0.12, { attack: 0.005 });
        this.playTone(440, 0.22, 'triangle', 0.16, { detune: 6 });
    }

    /** "¡YA!": pitido una octava más agudo, largo y con brillo. */
    playGo(): void {
        this.playTone(880, 0.55, 'square', 0.12);
        this.playTone(880, 0.55, 'sawtooth', 0.06, { detune: 8 });
        this.playTone(1760, 0.4, 'triangle', 0.08);
        this.playNoise(0.3, 7000, 0.08, { type: 'highpass' });
    }

    /**
     * Sílaba con voz sintetizada: una sierra (cuerdas vocales) pasada por dos filtros de formante de la vocal
     * "a", con un golpe de aire al principio. Sirve para las risas enlatadas.
     */
    private playVoiced(pitch: number, duration: number, at: number, gainValue: number): void {
        if (!this.canPlaySfx()) return;
        try {
            const ctx = this.getAudioContext();
            const start = ctx.currentTime + at;
            const end = start + duration;
            const source = ctx.createOscillator();
            source.type = 'sawtooth';
            source.frequency.setValueAtTime(pitch * 1.08, start);
            source.frequency.exponentialRampToValueAtTime(pitch * 0.9, end);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(Math.max(gainValue * this.sfxVolumeSignal(), 0.0002), start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);

            // Formantes de la "a" (≈ 800 y 1200 Hz)
            [[800, 6], [1200, 8]].forEach(([freq, q]) => {
                const formant = ctx.createBiquadFilter();
                formant.type = 'bandpass';
                formant.frequency.value = freq;
                formant.Q.value = q;
                source.connect(formant).connect(gain);
            });
            gain.connect(this.getSfxBus(ctx));
            source.start(start);
            source.stop(end + 0.02);
            // La "h" del "ja"
            this.playNoise(0.05, 1500, gainValue * 0.5, { at });
        } catch (error) {
            console.warn('[AudioService] Error playing voice:', error);
        }
    }

    /** Risas enlatadas (~2 s): un público de varias voces riéndose "ja-ja-ja" a destiempo, que crece y se apaga. */
    playLaughTrack(): void {
        const voices = 7;
        for (let v = 0; v < voices; v++) {
            const pitch = 160 + Math.random() * 220;
            let at = Math.random() * 0.25;
            const syllables = 6 + Math.floor(Math.random() * 6);
            for (let i = 0; i < syllables && at < 2; i++) {
                // Más fuerte al principio, se apaga al final
                const level = 0.05 * (1 - at / 2.2);
                this.playVoiced(pitch * (1 - i * 0.015), 0.09 + Math.random() * 0.05, at, level);
                at += 0.15 + Math.random() * 0.08;
            }
        }
        // Murmullo del público debajo
        this.playNoise(2, 900, 0.05, { type: 'bandpass', q: 0.6, attack: 0.3 });
    }

    /** Descarga eléctrica (50/50, ocultar texto). */
    playZap(): void {
        this.playTone(1800, 0.25, 'sawtooth', 0.1, { slideTo: 120 });
        this.playNoise(0.2, 6000, 0.12, { sweepTo: 500, q: 3 });
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
