import {
    AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewEncapsulation, computed, inject, signal, viewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { AudioService } from '../../shared/services/audio.service';
import { TutorialService } from '../tutorial.service';
import { TUTORIAL_CHAPTERS, TUTORIAL_SCENES, TutorialCue, TutorialScene } from '../tutorial-scenes';
import { ScenesEmpezarComponent } from '../scenes/empezar/scenes-empezar';
import { ScenesJugarComponent } from '../scenes/jugar/scenes-jugar';
import { ScenesManoComponent } from '../scenes/mano/scenes-mano';
import { ScenesAtaquesComponent } from '../scenes/ataques/scenes-ataques';
import { ScenesEspecialesComponent } from '../scenes/especiales/scenes-especiales';
import { ScenesFinalComponent } from '../scenes/final/scenes-final';

/** Medidas del lienzo de las escenas (el móvil): se escala entero para caber en la pantalla. */
const CANVAS_W = 400;
const CANVAS_H = 800;
/** Margen alrededor del móvil para los bocadillos y avatares que sobresalen. */
const CANVAS_MARGIN = 40;

/**
 * Reproductor del tutorial: un "vídeo" hecho con animaciones CSS. Lleva el reloj de la escena (pausable), cambia
 * los subtítulos y lanza los sonidos según el guion (tutorial-scenes.ts). Al pausar, la clase `paused` congela
 * todas las animaciones CSS a la vez, así que el reloj y lo que se ve no se desincronizan.
 *
 * Sin encapsulación: sus estilos (y el kit de piezas de la partida, tutorial-kit.scss) van prefijados con `.tut`
 * y los usan también las escenas.
 */
@Component({
    selector: 'app-tutorial-player',
    standalone: true,
    imports: [
        ScenesEmpezarComponent, ScenesJugarComponent, ScenesManoComponent, ScenesAtaquesComponent,
        ScenesEspecialesComponent, ScenesFinalComponent
    ],
    templateUrl: './tutorial-player.html',
    styleUrls: ['./tutorial-player.scss', './tutorial-kit.scss', './tutorial-kit-fx.scss'],
    encapsulation: ViewEncapsulation.None,
    host: {
        class: 'tut',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Cómo se juega: modo presencial',
        '[class.paused]': '!playing()'
    }
})
export class TutorialPlayerComponent implements AfterViewInit, OnDestroy {
    private tutorial = inject(TutorialService);
    private audio = inject(AudioService);
    private router = inject(Router);
    private host = inject<ElementRef<HTMLElement>>(ElementRef);

    readonly scenes = TUTORIAL_SCENES;
    readonly chapters = TUTORIAL_CHAPTERS;

    index = signal(0);
    /** Milisegundos transcurridos en la escena actual. */
    elapsed = signal(0);
    playing = signal(true);
    /** Cambia en cada (re)inicio de escena: vuelve a montar la escena para reiniciar sus animaciones. */
    run = signal(0);
    chaptersOpen = signal(false);
    scale = signal(1);
    muted = this.audio.muted;

    scene = computed<TutorialScene>(() => this.scenes[this.index()]);
    chapter = computed(() => this.chapters.find(c => c.id === this.scene().chapter)!);
    isLast = computed(() => this.index() === this.scenes.length - 1);
    ended = computed(() => this.isLast() && this.elapsed() >= this.scene().duration * 1000);

    /** Subtítulo que toca ahora (el último cuyo `at` ya ha pasado). */
    caption = computed(() => {
        const t = this.elapsed() / 1000;
        const caps = this.scene().captions;
        let current = caps[0];
        for (const c of caps) if (c.at <= t) current = c;
        return current;
    });

    /** Relleno de cada tramo de la barra de progreso (0-1). */
    segmentFill(i: number): number {
        if (i < this.index()) return 1;
        if (i > this.index()) return 0;
        return Math.min(1, this.elapsed() / (this.scene().duration * 1000));
    }

    readonly totalDuration = this.scenes.reduce((sum, s) => sum + s.duration, 0);

    private stage = viewChild.required<ElementRef<HTMLElement>>('stage');
    private closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
    private frame = 0;
    private last = 0;
    private resizeObserver?: ResizeObserver;
    private previousFocus: Element | null = null;
    private previousOverflow = '';

    constructor() {
        const start = this.tutorial.startChapter();
        if (start) {
            const i = this.scenes.findIndex(s => s.chapter === start);
            if (i >= 0) this.index.set(i);
        }
        if (typeof document !== 'undefined') {
            this.previousFocus = document.activeElement;
            this.previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
    }

    ngAfterViewInit(): void {
        this.resizeObserver = new ResizeObserver(() => this.fit());
        this.resizeObserver.observe(this.stage().nativeElement);
        this.fit();
        this.closeBtn()?.nativeElement.focus({ preventScroll: true });
        this.frame = requestAnimationFrame(this.tick);
    }

    ngOnDestroy(): void {
        cancelAnimationFrame(this.frame);
        this.resizeObserver?.disconnect();
        document.body.style.overflow = this.previousOverflow;
        if (this.previousFocus instanceof HTMLElement) this.previousFocus.focus({ preventScroll: true });
    }

    // ---------- Controles ----------

    togglePlay(): void {
        if (this.ended()) {
            this.restart();
            return;
        }
        this.playing.update(p => !p);
    }

    next(): void {
        if (!this.isLast()) this.goTo(this.index() + 1);
    }

    prev(): void {
        // Como en un reproductor: si la escena ya va avanzada, vuelve a empezarla; si no, a la anterior.
        if (this.elapsed() > 1500 || this.index() === 0) this.goTo(this.index());
        else this.goTo(this.index() - 1);
    }

    goTo(i: number): void {
        this.index.set(Math.max(0, Math.min(this.scenes.length - 1, i)));
        this.elapsed.set(0);
        this.run.update(r => r + 1);
        this.chaptersOpen.set(false);
    }

    goToChapter(id: string): void {
        const i = this.scenes.findIndex(s => s.chapter === id);
        if (i >= 0) {
            this.goTo(i);
            this.playing.set(true);
        }
    }

    restart(): void {
        this.goTo(0);
        this.playing.set(true);
    }

    toggleMute(): void {
        this.audio.toggleMute();
    }

    close(): void {
        this.tutorial.close();
    }

    joinRoom(): void {
        this.tutorial.close();
        this.router.navigate(['/unirse']);
    }

    isChapterActive(id: string): boolean {
        return this.scene().chapter === id;
    }

    @HostListener('document:keydown', ['$event'])
    onKey(event: KeyboardEvent): void {
        const target = event.target as HTMLElement | null;
        const onControl = !!target?.closest('button, a, input, select, textarea');
        switch (event.key) {
            case 'Tab':
                this.trapFocus(event);
                break;
            case 'Escape':
                if (this.chaptersOpen()) this.chaptersOpen.set(false);
                else this.close();
                event.preventDefault();
                break;
            case ' ':
            case 'k':
                if (onControl && event.key === ' ') return; // el espacio ya pulsa el botón enfocado
                this.togglePlay();
                event.preventDefault();
                break;
            case 'ArrowRight':
                this.next();
                event.preventDefault();
                break;
            case 'ArrowLeft':
                this.prev();
                event.preventDefault();
                break;
            case 'm':
                this.toggleMute();
                break;
        }
    }

    /** Pestaña oculta: el navegador frena los frames; se pausa para no desincronizar reloj y animaciones. */
    @HostListener('document:visibilitychange')
    onVisibility(): void {
        if (document.hidden) this.playing.set(false);
    }

    /** El foco no sale del tutorial (es un diálogo modal a pantalla completa). */
    private trapFocus(event: KeyboardEvent): void {
        const focusables = [...this.host.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = active instanceof HTMLElement && this.host.nativeElement.contains(active);
        if (event.shiftKey && (active === first || !inside)) {
            last.focus();
            event.preventDefault();
        } else if (!event.shiftKey && (active === last || !inside)) {
            first.focus();
            event.preventDefault();
        }
    }

    // ---------- Reloj ----------

    private tick = (now: number): void => {
        // Tiempo real (no frames): aunque el navegador espacie los frames, las animaciones CSS siguen al reloj
        // de pared, así que el del guion también. Solo se descartan saltos enormes (pestaña dormida).
        const dt = this.last ? Math.min(now - this.last, 1000) : 0;
        this.last = now;
        if (this.playing() && !this.ended()) this.advance(dt);
        this.frame = requestAnimationFrame(this.tick);
    };

    private advance(dt: number): void {
        const scene = this.scene();
        const duration = scene.duration * 1000;
        const before = this.elapsed();
        const after = Math.min(before + dt, duration);
        for (const cue of scene.cues) {
            const at = cue.at * 1000;
            if (at >= before && at < after) this.play(cue);
        }
        if (after >= duration && !this.isLast()) {
            this.goTo(this.index() + 1);
        } else {
            this.elapsed.set(after);
        }
    }

    private play(cue: TutorialCue): void {
        const a = this.audio;
        switch (cue.sfx) {
            case 'impact': a.playImpact(cue.arg ?? 1); break;
            case 'whoosh': a.playWhoosh(); break;
            case 'tick': a.playTick(cue.arg ?? 1); break;
            case 'turn': a.playTurnStart(); break;
            case 'correct': a.playCorrect(); break;
            case 'wrong': a.playWrong(); break;
            case 'suspense': a.playSuspense(cue.arg ?? 2500); break;
            case 'burn': a.playBurn(); break;
            case 'ruletaTick': a.playRuletaTick(); break;
            case 'ruletaStop': a.playRuletaStop(); break;
            case 'zap': a.playZap(); break;
            case 'reroll': a.playReroll(); break;
            case 'ring': a.playCallRing(); break;
            case 'money': a.playMoney(); break;
            case 'coins': a.playCoinsWin(); break;
            case 'lose': a.playLose(); break;
            case 'beep': a.playCountdownBeep(); break;
            case 'go': a.playGo(); break;
            case 'laugh': a.playLaughTrack(); break;
            case 'whistle': a.playWhistle(); break;
            case 'finalWhistle': a.playFinalWhistle(); break;
            case 'drumroll': a.playDrumroll(cue.arg ?? 1800); break;
            case 'fanfare': a.playFanfare(); break;
            case 'coinFlip': a.playCoinFlip(cue.arg ?? 1.5); break;
            case 'coinLand': a.playCoinLand(); break;
            case 'note': a.playNote(cue.arg ?? 880); break;
            case 'cheer': a.playCrowdCheer(); break;
        }
    }

    private fit(): void {
        const el = this.stage().nativeElement;
        const s = Math.min(el.clientWidth / (CANVAS_W + CANVAS_MARGIN), el.clientHeight / (CANVAS_H + CANVAS_MARGIN));
        this.scale.set(Math.max(0.2, s));
    }
}
