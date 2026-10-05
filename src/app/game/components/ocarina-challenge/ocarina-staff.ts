import type * as VexNs from 'vexflow';
import { NoteFigure, OcarinaNote } from '../../models/game.models';

/** Teclas de VexFlow de cada botón (Re4, Fa4, La4, Si4, Re5) y símbolo del botón de la ocarina. */
const KEYS = ['d/4', 'f/4', 'a/4', 'b/4', 'd/5'];
export const BUTTON_GLYPHS = ['A', '▼', '▶', '◀', '▲'];
export const NOTE_NAMES = ['Re', 'Fa', 'La', 'Si', 'Re'];

const DURATIONS: Record<NoteFigure, string> = {
    Semicorchea: '16',
    Corchea: '8',
    Negra: 'q',
    Blanca: 'h'
};

export type StaffNoteState = 'normal' | 'active' | 'error' | 'ok';

export interface StaffNote extends OcarinaNote {
    state?: StaffNoteState;
}

const COLORS: Record<StaffNoteState, string> = {
    normal: '#1f2937',
    active: '#2563eb',
    error: '#dc2626',
    ok: '#16a34a'
};

let vexflowPromise: Promise<typeof VexNs> | null = null;

/** Carga VexFlow (con la fuente musical Bravura incluida) la primera vez que hace falta. */
export function loadVexflow(): Promise<typeof VexNs> {
    vexflowPromise ??= import('vexflow/bravura').then(async vf => {
        // La fuente de las figuras se registra de forma asíncrona: esperar a que esté lista para no dibujar cuadros vacíos.
        try {
            await document.fonts.load('30px Bravura');
        } catch {
            /* se dibuja igualmente */
        }
        return vf as unknown as typeof VexNs;
    });
    return vexflowPromise;
}

/**
 * Dibuja un pentagrama (clave de sol) con las notas indicadas: figuras reales (semicorcheas, corcheas, negras,
 * blancas) con las corcheas unidas por barras, y el botón de la ocarina debajo de cada nota.
 * `onNoteClick` permite pulsar una nota (p. ej. para borrarla del carril).
 */
export function renderStaff(
    vf: typeof VexNs,
    container: HTMLElement,
    notes: StaffNote[],
    options: { width: number; onNoteClick?: (index: number) => void; showButtons?: boolean }
): void {
    container.innerHTML = '';
    const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Annotation } = vf;
    const height = 150;
    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(options.width, height);
    const ctx = renderer.getContext();
    ctx.setFillStyle(COLORS.normal);
    ctx.setStrokeStyle(COLORS.normal);

    const stave = new Stave(4, 18, options.width - 8);
    stave.addClef('treble').setContext(ctx).draw();
    if (notes.length === 0) return;

    const staveNotes = notes.map(n => {
        const note = new StaveNote({ keys: [KEYS[n.pitch]], duration: DURATIONS[n.figure] });
        const color = COLORS[n.state ?? 'normal'];
        note.setStyle({ fillStyle: color, strokeStyle: color });
        if (options.showButtons !== false) {
            note.addModifier(
                new Annotation(BUTTON_GLYPHS[n.pitch])
                    .setFont('Arial', 13, 'bold')
                    .setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
                0
            );
        }
        return note;
    });

    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickables(staveNotes);
    const beams = Beam.generateBeams(staveNotes);
    new Formatter().joinVoices([voice]).format([voice], Math.max(60, options.width - 80));
    voice.draw(ctx, stave);
    beams.forEach(b => b.setContext(ctx).draw());

    if (options.onNoteClick) {
        // VexFlow crea el SVG con pointer-events="none": hay que reactivarlos para poder pulsar las notas.
        container.querySelector('svg')?.setAttribute('pointer-events', 'auto');
        staveNotes.forEach((note, i) => {
            const el = note.getSVGElement();
            if (!el) return;
            // Zona de toque cómoda en el móvil: un rectángulo invisible que cubre la nota entera.
            const box = note.getBoundingBox();
            const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hit.setAttribute('x', String(box.getX() - 6));
            hit.setAttribute('y', String(box.getY() - 6));
            hit.setAttribute('width', String(box.getW() + 12));
            hit.setAttribute('height', String(box.getH() + 12));
            hit.setAttribute('fill', 'transparent');
            hit.setAttribute('pointer-events', 'all');
            el.appendChild(hit);
            el.style.cursor = 'pointer';
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', `Quitar la nota ${i + 1} (${NOTE_NAMES[notes[i].pitch]})`);
            el.addEventListener('click', () => options.onNoteClick!(i));
        });
    }
}
