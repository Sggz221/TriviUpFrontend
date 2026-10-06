/**
 * Avance 0..1 con salida suave (ease-out cúbica) durante `durationMs`, tras `delayMs`.
 * Va por tiempo transcurrido con un intervalo (no con requestAnimationFrame): en una pestaña en segundo
 * plano rAF se pausa y el conteo se quedaría a medias; así siempre llega al valor final.
 * Devuelve una función que lo cancela.
 */
export function countUp(durationMs: number, onProgress: (progress: number) => void, delayMs = 0): () => void {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
        const begin = performance.now();
        interval = setInterval(() => {
            const t = Math.min((performance.now() - begin) / durationMs, 1);
            onProgress(1 - Math.pow(1 - t, 3));
            if (t >= 1 && interval) {
                clearInterval(interval);
                interval = null;
            }
        }, 30);
    }, delayMs);

    return () => {
        clearTimeout(start);
        if (interval) clearInterval(interval);
    };
}

/** El usuario pidió reducir el movimiento: se muestran los estados finales sin animar. */
export function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
