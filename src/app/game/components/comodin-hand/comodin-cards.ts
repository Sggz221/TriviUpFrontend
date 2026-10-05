import { ComodinTipo } from '../../models/game.models';

/** Cómo se ve cada comodín como carta. `ataque`: se juega fuera del turno propio, contra quien responde. */
export interface ComodinCardInfo {
    icon: string;
    name: string;
    description: string;
    ataque: boolean;
}

export const COMODIN_CARDS: Record<ComodinTipo, ComodinCardInfo> = {
    Ruleta: { icon: '🎡', name: 'Ruleta', description: 'Elimina entre 0 y 3 respuestas incorrectas', ataque: false },
    CincuentaCincuenta: { icon: '✂️', name: '50/50', description: 'Elimina la mitad de las respuestas incorrectas', ataque: false },
    CambiarPregunta: { icon: '🔄', name: 'Cambiar pregunta', description: 'Cambias tu pregunta por otra de la misma fase, con tiempo completo', ataque: false },
    Pasar: { icon: '⏭️', name: 'Pasar', description: 'Saltas la pregunta sin puntos y pasa el turno', ataque: false },
    DobleONada: { icon: '🎲', name: 'Doble o nada', description: 'Acierto: +200 · Fallo: −100', ataque: false },
    Llamada: { icon: '📞', name: 'Llamada', description: 'Llamas a un amigo: el anfitrión cuelga cuando acabe', ataque: false },
    Robo: { icon: '🥷', name: 'Robar', description: 'Responde tú. Si fallas: −50 y vuelve al jugador original', ataque: true },
    CambiarPreguntaRival: { icon: '🔀', name: 'Cambiar su pregunta', description: 'Cambias la pregunta de quien responde por otra de la misma fase', ataque: true },
    OcultarTexto: { icon: '🙈', name: 'Ocultar texto', description: 'Oculta el texto de las respuestas de quien responde', ataque: true },
    Apuesta: { icon: '💰', name: 'Apostar', description: 'Apuesta si acierta o falla. Si aciertas: +50', ataque: true }
};

/** Carta en la mano: cuántos usos le quedan y si se puede jugar ahora mismo. */
export interface HandCard {
    tipo: ComodinTipo;
    uses: number;
    enabled: boolean;
}

/** Lo que se juega: el comodín y, en la Apuesta, si se apuesta a que acierta. */
export interface PlayedCard {
    tipo: ComodinTipo;
    predictsCorrect?: boolean;
}
