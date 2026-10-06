/** Pieza de confeti: la animación (.fx-confetti, en styles.css) lee estas variables. */
export interface ConfettiPiece {
    left: string;
    color: string;
    delay: string;
    duration: string;
    dx: string;
    rot: string;
    round: boolean;
}

const COLORES = ['#fff35c', '#ff4f6d', '#3fe0a0', '#12b5cb', '#c084fc', '#ffb02e'];

/** Genera `count` piezas con posición, color, retraso y giro pseudoaleatorios pero estables. */
export function confettiPieces(count: number): ConfettiPiece[] {
    return Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        return {
            left: `${(n * 37) % 100}%`,
            color: COLORES[n % COLORES.length],
            delay: `${((n * 13) % 20) * 0.06}s`,
            duration: `${2.4 + ((n * 7) % 10) * 0.18}s`,
            dx: `${((n * 29) % 60) - 30}vw`,
            rot: `${360 + ((n * 53) % 720)}deg`,
            round: n % 3 === 0
        };
    });
}
