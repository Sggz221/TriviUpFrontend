/**
 * Última partida en la que ha estado el jugador, con caducidad corta. Alimenta
 * el aviso "Partida en curso · Reconectar" (rejoin-toast) que aparece fuera de
 * la sala para volver a entrar con un clic sin reescribir el código.
 *
 * La reconexión en sí la hace la propia sala al navegar a /game/:code (joinGame
 * idempotente + identidad anónima de anonymous-identity.utils); aquí solo
 * recordamos a qué sala volver.
 */

// Se renueva mientras se juega (touchLastGame), así que solo caduca tras un
// rato realmente fuera de la sala.
const EXPIRY_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'triviup:lastGame';

export interface LastGame {
    roomCode: string;
    savedAt: number;
}

export function getLastGame(): LastGame | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        if (
            typeof parsed.roomCode === 'string' &&
            parsed.roomCode.length > 0 &&
            typeof parsed.savedAt === 'number' &&
            Date.now() - parsed.savedAt < EXPIRY_MS
        ) {
            return { roomCode: parsed.roomCode, savedAt: parsed.savedAt };
        }
    } catch {
        // localStorage no disponible o dato corrupto
    }
    return null;
}

export function saveLastGame(roomCode: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomCode, savedAt: Date.now() }));
    } catch {
        // localStorage no disponible: no es crítico, simplemente no persistimos
    }
}

/** Renueva la caducidad, solo si la última partida guardada es esta sala. */
export function touchLastGame(roomCode: string): void {
    if (getLastGame()?.roomCode === roomCode) saveLastGame(roomCode);
}

/** Olvida la última partida (salida voluntaria, expulsión, sala cerrada o partida terminada). */
export function clearLastGame(roomCode?: string): void {
    try {
        if (roomCode !== undefined && getLastGame()?.roomCode !== roomCode) return;
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // no crítico
    }
}
