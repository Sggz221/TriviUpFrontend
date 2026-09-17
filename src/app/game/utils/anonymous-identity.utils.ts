/**
 * Identidad anónima persistida por sala en sessionStorage. Un refresh (o entrar
 * de nuevo tras salir) reutiliza el mismo userId para que el backend lo reconozca
 * como el mismo jugador reconectando, en vez de crear una fila duplicada.
 *
 * Usado tanto por la sala (game-room, cuando refrescas ya dentro) como por el
 * formulario "Unirse a una Sala" (join-room, el punto de entrada más común) —
 * antes cada uno generaba su propio id anónimo por su cuenta y solo uno de los
 * dos lo guardaba, así que entrar por join-room y luego refrescar creaba un
 * jugador fantasma nuevo.
 */

function storageKey(roomCode: string): string {
    return `triviup:anon:${roomCode}`;
}

export function getOrCreateAnonymousUserId(roomCode: string): number {
    try {
        const stored = sessionStorage.getItem(storageKey(roomCode));
        if (stored) {
            const parsed = JSON.parse(stored);
            if (typeof parsed.userId === 'number') {
                return parsed.userId;
            }
        }
    } catch {
        // sessionStorage no disponible o dato corrupto: seguimos con uno nuevo
    }

    return Math.floor(Math.random() * 1000000);
}

export function saveAnonymousIdentity(roomCode: string, userId: number, username: string): void {
    try {
        sessionStorage.setItem(storageKey(roomCode), JSON.stringify({ userId, username }));
    } catch {
        // sessionStorage no disponible: no es crítico, simplemente no persistimos
    }
}
