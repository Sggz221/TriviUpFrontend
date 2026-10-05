import type * as ToneNs from 'tone';
import { NoteFigure, OcarinaNote } from '../../models/game.models';

/** Las cinco notas de la ocarina estilo Zelda, por botón: Re, Fa, La, Si, Re agudo. */
export const OCARINA_PITCHES = ['D4', 'F4', 'A4', 'B4', 'D5'] as const;

/** Igual que en el servidor (OcarinaMelody): negra a 72 bpm y pausa antes de la primera nota. */
export const QUARTER_MS = 833;
export const LEAD_IN_MS = 1500;

export function figureMs(figure: NoteFigure): number {
    switch (figure) {
        case 'Semicorchea': return QUARTER_MS / 4;
        case 'Corchea': return QUARTER_MS / 2;
        case 'Negra': return QUARTER_MS;
        default: return QUARTER_MS * 2;
    }
}

/** Lo que dura la melodía sonando (sin la pausa inicial). */
export function melodyMs(melody: OcarinaNote[]): number {
    return melody.reduce((total, n) => total + figureMs(n.figure), 0);
}

/**
 * Sintetizador con timbre de ocarina (onda senoidal con un poco de vibrato y filtro suave), hecho con
 * Tone.js: no hace falta ningún fichero de audio. Tone se carga bajo demanda la primera vez.
 */
export class OcarinaSynth {
    private tone: typeof ToneNs | null = null;
    private synth: ToneNs.Synth | null = null;
    private volume: ToneNs.Volume | null = null;

    async load(): Promise<void> {
        if (this.synth) return;
        const Tone = await import('tone');
        this.tone = Tone;
        this.volume = new Tone.Volume(-6).toDestination();
        const filter = new Tone.Filter(2400, 'lowpass').connect(this.volume);
        const vibrato = new Tone.Vibrato(5.5, 0.08).connect(filter);
        this.synth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.35 }
        }).connect(vibrato);
    }

    /** Desbloquea el audio del navegador (necesita que el usuario haya interactuado con la página). */
    async unlock(): Promise<boolean> {
        await this.load();
        try {
            await this.tone!.start();
        } catch {
            // Sin gesto del usuario el navegador lo deja suspendido
        }
        return this.tone!.getContext().state === 'running';
    }

    isRunning(): boolean {
        return this.tone?.getContext().state === 'running';
    }

    /** Volumen 0-1 (0 = silencio), para respetar el volumen de efectos del usuario. */
    setVolume(level: number): void {
        if (!this.volume || !this.tone) return;
        this.volume.mute = level <= 0;
        if (level > 0) this.volume.volume.value = this.tone.gainToDb(level) - 6;
    }

    /** Toca una nota de botón (al pulsarlo). */
    playPitch(pitch: number, figure: NoteFigure = 'Corchea'): void {
        if (!this.synth || !this.tone || !this.isRunning()) return;
        this.synth.triggerAttackRelease(OCARINA_PITCHES[pitch], (figureMs(figure) / 1000) * 0.9, this.tone.now());
    }

    /** Toca la melodía empezando dentro de `delayMs`. Devuelve en qué momento (ms desde ahora) empieza cada nota. */
    playMelody(melody: OcarinaNote[], delayMs: number): number[] {
        const starts: number[] = [];
        let at = delayMs;
        for (const note of melody) {
            starts.push(at);
            at += figureMs(note.figure);
        }
        if (this.synth && this.tone && this.isRunning()) {
            const now = this.tone.now();
            melody.forEach((note, i) =>
                this.synth!.triggerAttackRelease(OCARINA_PITCHES[note.pitch], (figureMs(note.figure) / 1000) * 0.9, now + starts[i] / 1000));
        }
        return starts;
    }

    dispose(): void {
        this.synth?.dispose();
        this.volume?.dispose();
        this.synth = null;
        this.volume = null;
    }
}
