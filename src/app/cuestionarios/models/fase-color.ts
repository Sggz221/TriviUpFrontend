/** Paleta por defecto de las fases: si una fase no tiene color configurado se usa una por su número. */
export const PALETA_FASES: string[] = [
    '#3b82f6', // azul
    '#ef4444', // rojo
    '#22c55e', // verde
    '#f59e0b', // ámbar
    '#a855f7', // violeta
    '#14b8a6', // turquesa
    '#ec4899', // rosa
    '#f97316'  // naranja
];

const FORMATO_COLOR = /^#[0-9a-fA-F]{6}$/;

export function esColorValido(valor: string | null | undefined): valor is string {
    return !!valor && FORMATO_COLOR.test(valor);
}

/** Color de una fase: el configurado si es válido, o el de la paleta según su número (1..n). */
export function colorDeFase(numero: number | null | undefined, configurado?: string | null): string {
    if (esColorValido(configurado)) return configurado.toLowerCase();
    const indice = Math.max((numero ?? 1) - 1, 0) % PALETA_FASES.length;
    return PALETA_FASES[indice];
}

/** Texto legible (oscuro o claro) sobre un color de fondo #rrggbb, por luminosidad. */
export function textoSobreColor(fondo: string): string {
    const r = parseInt(fondo.slice(1, 3), 16);
    const g = parseInt(fondo.slice(3, 5), 16);
    const b = parseInt(fondo.slice(5, 7), 16);
    const luminosidad = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminosidad > 0.6 ? '#111827' : '#ffffff';
}
