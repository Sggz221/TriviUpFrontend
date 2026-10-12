/** Piezas comunes de las escenas del tutorial. */

export interface ConfettiPiece {
    x: string;
    c: string;
    pd: string;
    dx: string;
    r: string;
    fd: string;
}

const CONFETTI_COLORS = ['#fff35c', '#3fe0a0', '#ff4f6d', '#12b5cb', '#c4a1ff', '#ffb02e'];

/** Confeti fijo (sin aleatorio: la animación se ve igual cada vez). */
export const CONFETTI: ConfettiPiece[] = Array.from({ length: 30 }, (_, i) => {
    const k = (i * 37) % 30;
    return {
        x: `${(k * 3.33 + 1).toFixed(1)}%`,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        pd: `${((i * 53) % 40) / 100}s`,
        dx: `${((i * 29) % 80) - 40}px`,
        r: `${360 + ((i * 71) % 540)}deg`,
        fd: `${1.8 + ((i * 17) % 10) / 10}s`
    };
});

/** Convierte un texto en letras para "teclearlo": cada una aparece `step` segundos después de la anterior. */
export function typed(text: string, from: number, step: number): { ch: string; d: string }[] {
    return [...text].map((ch, i) => ({ ch, d: `${(from + i * step).toFixed(2)}s` }));
}
