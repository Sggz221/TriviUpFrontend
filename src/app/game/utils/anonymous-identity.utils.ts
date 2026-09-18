/**
 * Identidad anónima persistida por sala, con caducidad corta. Un refresh (o
 * entrar de nuevo tras salir) reutiliza el mismo userId para que el backend lo
 * reconozca como el mismo jugador reconectando, en vez de crear una fila
 * duplicada.
 *
 * Usa localStorage en vez de sessionStorage: en móvil (Safari/iOS en
 * particular) el navegador puede descartar una pestaña en segundo plano y
 * "revivirla" luego como si fuera una navegación nueva, perdiendo
 * sessionStorage aunque para el usuario parezca la misma pestaña de siempre.
 * La caducidad (renovable mientras se juega) evita que un id anónimo quede vivo para siempre
 * en el dispositivo — pasado ese tiempo sin volver a esta sala, se genera uno
 * nuevo, como si fuera la primera vez.
 *
 * Usado tanto por la sala (game-room, cuando refrescas ya dentro) como por el
 * formulario "Unirse a una Sala" (join-room, el punto de entrada más común).
 */

// Se renueva con actividad (touchAnonymousIdentity), así que solo caduca tras
// un rato realmente sin volver a la sala.
const EXPIRY_MS = 12 * 60 * 60 * 1000;

function storageKey(roomCode: string): string {
    return `triviup:anon:${roomCode}`;
}

export function getOrCreateAnonymousUserId(roomCode: string): number {
    try {
        const stored = localStorage.getItem(storageKey(roomCode));
        if (stored) {
            const parsed = JSON.parse(stored);
            if (
                typeof parsed.userId === 'number' &&
                typeof parsed.savedAt === 'number' &&
                Date.now() - parsed.savedAt < EXPIRY_MS
            ) {
                return parsed.userId;
            }
        }
    } catch {
        // localStorage no disponible o dato corrupto/caducado: seguimos con uno nuevo
    }

    return Math.floor(Math.random() * 1000000);
}

export function saveAnonymousIdentity(roomCode: string, userId: number, username: string): void {
    try {
        localStorage.setItem(storageKey(roomCode), JSON.stringify({ userId, username, savedAt: Date.now() }));
    } catch {
        // localStorage no disponible: no es crítico, simplemente no persistimos
    }
}

/** Renueva la caducidad de la identidad guardada (llamar mientras el jugador está activo en la sala). */
export function touchAnonymousIdentity(roomCode: string): void {
    try {
        const stored = localStorage.getItem(storageKey(roomCode));
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (typeof parsed.userId !== 'number') return;
        localStorage.setItem(storageKey(roomCode), JSON.stringify({ ...parsed, savedAt: Date.now() }));
    } catch {
        // no crítico
    }
}
