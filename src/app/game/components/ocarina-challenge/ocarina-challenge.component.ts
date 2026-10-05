import {
    AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, effect, inject, input, signal
} from '@angular/core';
import type * as VexNs from 'vexflow';
import { OcarinaNote } from '../../models/game.models';
import { GameSignalrService } from '../../services/game-signalr.service';
import { AudioService } from '../../../shared/services/audio.service';
import { OcarinaSynth, melodyMs } from './ocarina-audio';
import { BUTTON_GLYPHS, NOTE_NAMES, StaffNote, loadVexflow, renderStaff } from './ocarina-staff';

type AttemptStatus = 'idle' | 'checking' | 'error' | 'ok';

/**
 * Pregunta especial Ocarina: suena una melodía (lenta, una sola vez) dibujada en un pentagrama; después los
 * jugadores la reproducen con los cinco botones. Las notas van a un carril (se pueden quitar pulsándolas o con
 * "Borrar") y al llenarlo se envía el intento. El primero que acierta se lleva la pregunta.
 */
@Component({
    selector: 'app-ocarina-challenge',
    standalone: true,
    templateUrl: './ocarina-challenge.component.html',
    styleUrl: './ocarina-challenge.component.scss'
})
export class OcarinaChallengeComponent implements AfterViewInit, OnDestroy {
    private signalr = inject(GameSignalrService);
    private audio = inject(AudioService);

    roomCode = input.required<string>();
    questionId = input.required<number>();
    melody = input.required<OcarinaNote[]>();
    /** Lo que le queda a la melodía por sonar al recibir la pregunta (ms). */
    listenRemainingMs = input<number>(0);
    /** Jugador que puede tocar (el anfitrión y los espectadores solo miran y escuchan). */
    canPlay = input<boolean>(false);

    @ViewChild('melodyStaff') private melodyStaff?: ElementRef<HTMLDivElement>;
    @ViewChild('laneStaff') private laneStaff?: ElementRef<HTMLDivElement>;

    readonly buttons = [0, 1, 2, 3, 4].map(pitch => ({ pitch, glyph: BUTTON_GLYPHS[pitch], name: NOTE_NAMES[pitch] }));

    /** La melodía todavía está sonando: no se puede tocar. */
    listening = signal(true);
    /** Nota de la melodía que está sonando ahora (para resaltarla). */
    activeIndex = signal<number | null>(null);
    entered = signal<number[]>([]);
    status = signal<AttemptStatus>('idle');
    loading = signal(true);
    /** El navegador no ha dejado sonar el audio (falta un toque en la página). */
    soundBlocked = signal(false);

    canPress = computed(() => this.canPlay() && !this.listening() && this.status() === 'idle'
        && this.entered().length < this.melody().length);

    private synth = new OcarinaSynth();
    private vf: typeof VexNs | null = null;
    private timers: ReturnType<typeof setTimeout>[] = [];
    private destroyed = false;

    constructor() {
        // Volver a dibujar los pentagramas cuando cambian las notas o su estado.
        effect(() => {
            this.activeIndex();
            this.entered();
            this.status();
            this.melody();
            this.draw();
        });
    }

    async ngAfterViewInit(): Promise<void> {
        const remaining = this.listenRemainingMs();
        this.listening.set(remaining > 0);
        this.timers.push(setTimeout(() => this.listening.set(false), remaining));

        const [vf] = await Promise.all([loadVexflow(), this.synth.load()]);
        if (this.destroyed) return;
        this.vf = vf;
        this.loading.set(false);
        this.applyVolume();

        const running = await this.synth.unlock();
        this.soundBlocked.set(!running);

        // La melodía suena una sola vez, cuando lo marca el servidor. Si se entra con ella ya empezada, no se repite.
        const delay = remaining - melodyMs(this.melody());
        if (delay >= 0) {
            const starts = this.synth.playMelody(this.melody(), delay);
            starts.forEach((at, i) => this.timers.push(setTimeout(() => this.activeIndex.set(i), at)));
            this.timers.push(setTimeout(() => this.activeIndex.set(null), remaining));
        }
        this.draw();
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.timers.forEach(t => clearTimeout(t));
        this.synth.dispose();
    }

    /** Toque del usuario para desbloquear el audio si el navegador lo había bloqueado. */
    async enableSound(): Promise<void> {
        this.soundBlocked.set(!(await this.synth.unlock()));
    }

    press(pitch: number): void {
        if (!this.canPress()) return;
        this.applyVolume();
        const position = this.entered().length;
        this.synth.playPitch(pitch, this.melody()[position]?.figure ?? 'Corchea');
        this.entered.update(notes => [...notes, pitch]);
        if (this.entered().length === this.melody().length) {
            void this.submit();
        }
    }

    removeLast(): void {
        if (this.status() !== 'idle') return;
        this.entered.update(notes => notes.slice(0, -1));
    }

    removeAt(index: number): void {
        if (this.status() !== 'idle') return;
        this.entered.update(notes => notes.filter((_, i) => i !== index));
    }

    clear(): void {
        if (this.status() !== 'idle') return;
        this.entered.set([]);
    }

    @HostListener('document:keydown', ['$event'])
    onKey(event: KeyboardEvent): void {
        if (!this.canPlay()) return;
        const target = event.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        const pitch = ({ a: 0, A: 0, ArrowDown: 1, ArrowRight: 2, ArrowLeft: 3, ArrowUp: 4 } as Record<string, number>)[event.key];
        if (pitch !== undefined) {
            event.preventDefault();
            this.press(pitch);
        } else if (event.key === 'Backspace') {
            event.preventDefault();
            this.removeLast();
        }
    }

    private async submit(): Promise<void> {
        this.status.set('checking');
        try {
            const correct = await this.signalr.submitOcarina(this.roomCode(), this.questionId(), this.entered());
            if (correct) {
                this.status.set('ok');
                this.audio.playCorrect();
                return;
            }
            // Fallo: solo en este cliente, las notas tiemblan en rojo y suena el fallo; luego se puede reintentar.
            this.status.set('error');
            this.audio.playWrong();
            navigator.vibrate?.([90, 50, 90]);
            this.timers.push(setTimeout(() => {
                this.entered.set([]);
                this.status.set('idle');
            }, 1100));
        } catch (error) {
            // Otro ya la tocó o cambió la pregunta: la sala pasa al siguiente estado por su cuenta.
            console.warn('[Ocarina] Intento rechazado:', error);
            this.entered.set([]);
            this.status.set('idle');
        }
    }

    private applyVolume(): void {
        this.synth.setVolume(this.audio.muted() ? 0 : this.audio.sfxVolume());
    }

    private draw(): void {
        if (!this.vf) return;
        const melody = this.melody();
        if (this.melodyStaff) {
            const notes: StaffNote[] = melody.map((n, i) => ({ ...n, state: this.activeIndex() === i ? 'active' : 'normal' }));
            renderStaff(this.vf, this.melodyStaff.nativeElement, notes, { width: this.widthOf(this.melodyStaff) });
        }
        if (this.laneStaff) {
            const state = this.status() === 'error' ? 'error' : this.status() === 'ok' ? 'ok' : 'normal';
            // Cada nota del carril toma la figura de la nota de la melodía en esa posición.
            const notes: StaffNote[] = this.entered().map((pitch, i) => ({ pitch, figure: melody[i]?.figure ?? 'Negra', state }));
            renderStaff(this.vf, this.laneStaff.nativeElement, notes, {
                width: this.widthOf(this.laneStaff),
                onNoteClick: this.status() === 'idle' ? i => this.removeAt(i) : undefined
            });
        }
    }

    private widthOf(ref: ElementRef<HTMLDivElement>): number {
        return Math.max(260, Math.min(560, ref.nativeElement.clientWidth || 360));
    }
}
