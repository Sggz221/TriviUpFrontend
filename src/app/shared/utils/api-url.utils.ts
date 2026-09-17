/**
 * Backend público en Railway. El frontend ya no pasa por un proxy de nginx:
 * llama directamente a este origen para todo (API, auth, SignalR, storage).
 */
const PROD_BACKEND_URL = 'https://triviup-backend-production.up.railway.app';

/**
 * Devuelve el origen del backend a anteponer a las rutas de la API.
 * En local (ng serve) devuelve '' para seguir usando proxy.conf.json.
 */
export function getApiBaseUrl(): string {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return '';
    }
    return PROD_BACKEND_URL;
}
