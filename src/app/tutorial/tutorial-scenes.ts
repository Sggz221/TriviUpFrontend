/**
 * Guion del tutorial (modo presencial, visto por un jugador): escenas, subtítulos y efectos de sonido.
 *
 * Todos los tiempos van en segundos desde el inicio de la escena y tienen que cuadrar con los retrasos de las
 * animaciones CSS de cada escena (`--d`, `--o`... en scenes/*.html): el reproductor solo lleva el reloj, cambia
 * los subtítulos y lanza los sonidos; lo que se mueve lo mueve el CSS.
 */

export type TutorialChapterId = 'empezar' | 'jugar' | 'comodines' | 'especiales' | 'final';

export type TutorialSceneId =
    | 'intro' | 'unirse'
    | 'turnos' | 'pregunta' | 'responder' | 'fallo'
    | 'mano' | 'turno' | 'ataques'
    | 'pulsador' | 'colores' | 'ocarina'
    | 'fases' | 'podio' | 'normas' | 'outro';

/** Sonidos del AudioService que usa el guion (`arg` se pasa a los que lo aceptan: duración, tono...). */
export type TutorialSfx =
    | 'impact' | 'whoosh' | 'tick' | 'turn' | 'correct' | 'wrong' | 'suspense' | 'burn' | 'ruletaTick'
    | 'ruletaStop' | 'zap' | 'reroll' | 'ring' | 'money' | 'coins' | 'lose' | 'beep' | 'go' | 'laugh'
    | 'whistle' | 'finalWhistle' | 'drumroll' | 'fanfare' | 'coinFlip' | 'coinLand' | 'note' | 'cheer';

export interface TutorialCaption {
    at: number;
    title: string;
    text: string;
}

export interface TutorialCue {
    at: number;
    sfx: TutorialSfx;
    arg?: number;
}

export interface TutorialScene {
    id: TutorialSceneId;
    chapter: TutorialChapterId;
    /** Nombre corto para la barra de progreso. */
    label: string;
    duration: number;
    captions: TutorialCaption[];
    cues: TutorialCue[];
}

export interface TutorialChapter {
    id: TutorialChapterId;
    label: string;
    icon: string;
}

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
    { id: 'empezar', label: 'Entrar en la partida', icon: '📲' },
    { id: 'jugar', label: 'Turnos y respuestas', icon: '🎤' },
    { id: 'comodines', label: 'Comodines', icon: '🃏' },
    { id: 'especiales', label: 'Preguntas especiales', icon: '🔔' },
    { id: 'final', label: 'Fases, podio y normas', icon: '🏆' }
];

/** Ruleta: un tic por hueco, cada vez más separados (el giro frena). */
const ruletaTicks = (from: number, to: number, count: number): TutorialCue[] =>
    Array.from({ length: count }, (_, i) => {
        const k = i / (count - 1);
        return { at: +(from + (to - from) * (1 - (1 - k) * (1 - k))).toFixed(2), sfx: 'ruletaTick' as const };
    });

/** Frecuencias de los botones de la ocarina: Re, Fa, La, Si, Re agudo. */
export const OCARINA_FREQ = [587.33, 698.46, 880, 987.77, 1174.66];

export const TUTORIAL_SCENES: TutorialScene[] = [
    {
        id: 'intro', chapter: 'empezar', label: 'Presentación', duration: 7.5,
        captions: [
            { at: 0, title: 'Modo presencial', text: 'Jugáis todos juntos, en la misma habitación.' },
            { at: 2.2, title: 'El anfitrión dirige', text: 'Desde su pantalla lee las preguntas, destapa las respuestas y marca lo que digáis.' },
            { at: 4.4, title: 'Tú juegas desde el móvil', text: 'Vamos a ver una partida desde tus ojos. ¡Eres Lucía!' }
        ],
        cues: [
            { at: 0.25, sfx: 'impact' }, { at: 0.9, sfx: 'whoosh' }, { at: 2.2, sfx: 'tick', arg: 0.8 },
            { at: 2.9, sfx: 'tick', arg: 1 }, { at: 3.2, sfx: 'tick', arg: 1.15 }, { at: 3.5, sfx: 'tick', arg: 1.3 },
            { at: 4.4, sfx: 'turn' }, { at: 6.4, sfx: 'whoosh' }
        ]
    },
    {
        id: 'unirse', chapter: 'empezar', label: 'Unirse', duration: 12,
        captions: [
            { at: 0, title: 'Entra en la sala', text: 'En «Unirse a una sala», escribe el código que se ve en la pantalla del anfitrión… o escanea su QR.' },
            { at: 3.4, title: 'Pon tu nombre', text: 'Si jugáis por equipos, ¡poned el nombre del equipo!' },
            { at: 5.6, title: 'Sala de espera', text: 'Aquí verás quién está dentro. Cuando estéis todos, el anfitrión empieza la partida.' },
            { at: 9.4, title: '¡Empieza!', text: 'Cuenta atrás… y a jugar.' }
        ],
        cues: [
            ...[1.0, 1.25, 1.5, 1.75, 2.0, 2.25].map(at => ({ at, sfx: 'tick' as const, arg: 1.2 })),
            { at: 2.9, sfx: 'tick', arg: 0.8 },
            ...[3.8, 4.0, 4.2, 4.4, 4.6].map(at => ({ at, sfx: 'tick' as const, arg: 1.4 })),
            { at: 5.1, sfx: 'tick', arg: 0.8 }, { at: 5.5, sfx: 'whoosh' },
            { at: 5.9, sfx: 'tick', arg: 1 }, { at: 6.3, sfx: 'tick', arg: 1.1 }, { at: 7.0, sfx: 'tick', arg: 1.2 }, { at: 7.7, sfx: 'tick', arg: 1.3 },
            { at: 9.4, sfx: 'beep' }, { at: 10.1, sfx: 'beep' }, { at: 10.8, sfx: 'beep' }, { at: 11.5, sfx: 'go' }
        ]
    },
    {
        id: 'turnos', chapter: 'jugar', label: 'Fases y turnos', duration: 9.5,
        captions: [
            { at: 0, title: 'Fases', text: 'Las preguntas se agrupan en fases. Arriba verás siempre en cuál estáis.' },
            { at: 2.6, title: 'Turnos', text: 'Se juega por turnos: cada pregunta es de un jugador (o equipo).' },
            { at: 5.2, title: '¡Te toca!', text: 'Cuando el cartel muestre tu nombre, la pregunta es tuya.' }
        ],
        cues: [
            { at: 0.3, sfx: 'whoosh' }, { at: 0.55, sfx: 'impact', arg: 0.7 },
            { at: 2.7, sfx: 'turn' }, { at: 5.3, sfx: 'turn' }, { at: 5.6, sfx: 'impact', arg: 0.6 }
        ]
    },
    {
        id: 'pregunta', chapter: 'jugar', label: 'La pregunta', duration: 10.5,
        captions: [
            { at: 0, title: 'La pregunta', text: 'Sale en tu móvil y el anfitrión la lee en voz alta.' },
            { at: 3, title: 'Respuestas tapadas', text: 'El anfitrión las va destapando una a una. Mientras quede alguna «?», ¡espera!' },
            { at: 7.6, title: 'Colores y formas', text: 'Cada respuesta tiene su color y su forma: podéis decir «¡la azul!» o «¡el círculo!».' }
        ],
        cues: [
            { at: 0.3, sfx: 'whoosh' }, { at: 0.9, sfx: 'tick', arg: 0.7 }, { at: 1.05, sfx: 'tick', arg: 0.7 },
            { at: 1.2, sfx: 'tick', arg: 0.7 }, { at: 1.35, sfx: 'tick', arg: 0.7 },
            { at: 3.2, sfx: 'tick', arg: 1 }, { at: 4.3, sfx: 'tick', arg: 1.12 }, { at: 5.4, sfx: 'tick', arg: 1.25 },
            { at: 6.5, sfx: 'tick', arg: 1.4 }, { at: 6.6, sfx: 'impact', arg: 0.4 }
        ]
    },
    {
        id: 'responder', chapter: 'jugar', label: 'Responder', duration: 12.5,
        captions: [
            { at: 0, title: 'Dilo en voz alta', text: 'En presencial no tocas las respuestas: dices la tuya y el anfitrión la marca.' },
            { at: 3, title: '¿Dudas?', text: 'Puedes cambiar de idea hasta que el anfitrión confirme.' },
            { at: 5.4, title: 'Sin reloj', text: 'Aquí no hay cuenta atrás. El anfitrión confirma… ¡y llega el momento de la verdad!' },
            { at: 8, title: '+100 puntos', text: 'Cada acierto suma 100 puntos.' }
        ],
        cues: [
            { at: 1.0, sfx: 'tick', arg: 1.3 }, { at: 2.0, sfx: 'tick', arg: 0.9 }, { at: 3.0, sfx: 'tick', arg: 1.3 },
            { at: 3.6, sfx: 'tick', arg: 0.9 }, { at: 4.3, sfx: 'tick', arg: 1.3 }, { at: 4.8, sfx: 'tick', arg: 0.9 },
            { at: 5.5, sfx: 'suspense', arg: 2500 }, { at: 8, sfx: 'correct' }, { at: 8, sfx: 'impact' }
        ]
    },
    {
        id: 'fallo', chapter: 'jugar', label: 'Fallar', duration: 8,
        captions: [
            { at: 0, title: '¿Y si se falla?', text: 'Ahora le toca a Marcos…' },
            { at: 3.6, title: 'Fallar no resta', text: 'Fallar no quita puntos (salvo con algunos comodines). Se ve cuál era la buena.' },
            { at: 6, title: 'Siguiente', text: 'Cuando todos lo han visto, el anfitrión pasa a la siguiente pregunta.' }
        ],
        cues: [
            { at: 0.2, sfx: 'turn' }, { at: 2.4, sfx: 'tick', arg: 1.3 }, { at: 2.9, sfx: 'tick', arg: 0.9 },
            { at: 3.6, sfx: 'wrong' }, { at: 6.6, sfx: 'whoosh' }
        ]
    },
    {
        id: 'mano', chapter: 'comodines', label: 'Tu mano', duration: 12,
        captions: [
            { at: 0, title: 'Tus comodines', text: 'Abajo tienes tu mano de cartas. Tócala para desplegarla.' },
            { at: 2.4, title: 'Moradas: tu turno', text: 'En tu turno solo ves los comodines que se juegan en tu turno.' },
            { at: 6.2, title: 'Rojas: ataques', text: 'Cuando le toca a otro aparecen tus ataques, contra quien está respondiendo.' },
            { at: 8.6, title: 'Usos', text: 'El número de la esquina son los usos que te quedan. Al gastar el último, la carta arde.' }
        ],
        cues: [
            { at: 0.4, sfx: 'whoosh' }, { at: 1.6, sfx: 'tick', arg: 0.9 }, { at: 1.8, sfx: 'whoosh' },
            { at: 5.6, sfx: 'tick', arg: 0.9 }, { at: 6.2, sfx: 'turn' }, { at: 8.6, sfx: 'tick', arg: 0.9 },
            { at: 9.2, sfx: 'burn' }
        ]
    },
    {
        id: 'turno', chapter: 'comodines', label: 'De tu turno', duration: 23,
        captions: [
            { at: 0, title: '🎡 Ruleta', text: 'Gira la ruleta: elimina entre 0 y 3 respuestas incorrectas. ¡Suerte!' },
            { at: 4.6, title: '✂️ 50/50', text: 'Elimina la mitad de las respuestas incorrectas.' },
            { at: 8.8, title: '🔄 Cambiar pregunta', text: 'Cambias tu pregunta por otra de la misma fase. El anfitrión vuelve a destapar las respuestas.' },
            { at: 13.2, title: '🎲 Doble o nada', text: 'Si aciertas, +200. Si fallas, −100. ¿Te atreves?' },
            { at: 17.4, title: '📞 Llamada', text: 'Llama a un amigo para que te ayude. El anfitrión cuelga cuando acabéis.' }
        ],
        cues: [
            { at: 0.2, sfx: 'whoosh' }, ...ruletaTicks(1.3, 3.2, 14), { at: 3.25, sfx: 'ruletaStop' }, { at: 3.9, sfx: 'zap' },
            { at: 4.8, sfx: 'whoosh' }, { at: 6.0, sfx: 'zap' },
            { at: 9.0, sfx: 'whoosh' }, { at: 10.2, sfx: 'reroll' }, { at: 11.4, sfx: 'tick' }, { at: 11.8, sfx: 'tick', arg: 1.1 },
            { at: 12.2, sfx: 'tick', arg: 1.2 }, { at: 12.6, sfx: 'tick', arg: 1.3 },
            { at: 13.4, sfx: 'whoosh' }, { at: 14.4, sfx: 'impact' }, { at: 15.4, sfx: 'money' },
            { at: 17.6, sfx: 'whoosh' }, { at: 18.4, sfx: 'ring' }, { at: 20.0, sfx: 'ring' }, { at: 21.6, sfx: 'impact', arg: 0.5 }
        ]
    },
    {
        id: 'ataques', chapter: 'comodines', label: 'Ataques', duration: 21,
        captions: [
            { at: 0, title: 'Ataques', text: 'Se juegan cuando le toca a otro. Ahora responde Marcos…' },
            { at: 2.2, title: '¡Todos lo ven!', text: 'Cuando alguien usa un comodín, sale en grande en todas las pantallas.' },
            { at: 4.8, title: '🥷 Robar', text: 'Respondes tú en su lugar. Si fallas: −50 y la pregunta vuelve a él.' },
            { at: 7.4, title: 'Ojo', text: 'No se puede robar una pregunta en la que ya se ha usado otro comodín.' },
            { at: 9.2, title: '💰 Apostar', text: '¿Acertará o fallará? Si aciertas tu apuesta, +50.' },
            { at: 15, title: '🔀 Cambiar su pregunta', text: 'Le cambias la pregunta a quien responde por otra de la misma fase.' }
        ],
        cues: [
            { at: 1.6, sfx: 'tick', arg: 0.9 }, { at: 2.2, sfx: 'whoosh' }, { at: 2.5, sfx: 'impact' },
            { at: 5.6, sfx: 'tick', arg: 1.3 }, { at: 6.2, sfx: 'wrong' },
            { at: 9.0, sfx: 'tick', arg: 0.9 }, { at: 9.8, sfx: 'tick', arg: 1 }, { at: 10.6, sfx: 'tick', arg: 0.9 }, { at: 10.9, sfx: 'money' },
            { at: 12.0, sfx: 'tick', arg: 1.3 }, { at: 12.8, sfx: 'wrong' }, { at: 13.6, sfx: 'coins' },
            { at: 15.2, sfx: 'tick', arg: 0.9 }, { at: 15.8, sfx: 'reroll' }, { at: 17.2, sfx: 'tick', arg: 1.4 }
        ]
    },
    {
        id: 'pulsador', chapter: 'especiales', label: 'Pulsador', duration: 12.5,
        captions: [
            { at: 0, title: '🔔 Pulsador', text: 'En estas preguntas no hay turnos: responde quien pulse primero.' },
            { at: 2, title: 'Atento a la cuenta atrás', text: 'Nadie puede pulsar hasta que acabe… y a veces es de broma. ¡No te precipites!' },
            { at: 8.4, title: '¡Pulsa!', text: 'Si pulsas antes que nadie, la pregunta es tuya: dila en voz alta.' }
        ],
        cues: [
            { at: 0.3, sfx: 'whoosh' },
            { at: 2.0, sfx: 'beep' }, { at: 2.6, sfx: 'beep' }, { at: 3.2, sfx: 'beep' }, { at: 3.8, sfx: 'laugh' },
            { at: 5.6, sfx: 'beep' }, { at: 6.1, sfx: 'beep' }, { at: 6.6, sfx: 'beep' }, { at: 7.1, sfx: 'beep' },
            { at: 7.6, sfx: 'beep' }, { at: 8.1, sfx: 'go' }, { at: 8.6, sfx: 'impact' }, { at: 8.9, sfx: 'turn' }
        ]
    },
    {
        id: 'colores', chapter: 'especiales', label: 'Colores', duration: 12,
        captions: [
            { at: 0, title: '🎨 Colores', text: 'Sale un color al azar. Todos a la vez tenéis que imitarlo.' },
            { at: 1.4, title: 'Tono, saturación y brillo', text: 'Mueve las tres barras hasta que tu color se parezca lo máximo posible.' },
            { at: 5.6, title: 'Envíalo a tiempo', text: 'Tienes un minuto. Quien más se acerque se lleva la pregunta.' }
        ],
        cues: [
            { at: 0.3, sfx: 'whoosh' }, { at: 5.6, sfx: 'tick', arg: 0.9 }, { at: 7.0, sfx: 'drumroll', arg: 900 },
            { at: 8.0, sfx: 'impact', arg: 0.6 }, { at: 8.3, sfx: 'correct' }
        ]
    },
    {
        id: 'ocarina', chapter: 'especiales', label: 'Ocarina', duration: 12,
        captions: [
            { at: 0, title: '🎵 Ocarina', text: 'Suena una melodía (dos veces). Escúchala bien…' },
            { at: 3.6, title: '¡Tócala!', text: '…y repítela con los botones. El primero que la toque bien, responde.' },
            { at: 8.4, title: 'Sin comodines', text: 'En las preguntas de pulsador, colores y ocarina no se pueden usar comodines.' }
        ],
        cues: [
            { at: 0.3, sfx: 'whoosh' },
            { at: 1.0, sfx: 'note', arg: OCARINA_FREQ[2] }, { at: 1.5, sfx: 'note', arg: OCARINA_FREQ[0] },
            { at: 2.0, sfx: 'note', arg: OCARINA_FREQ[1] }, { at: 2.5, sfx: 'note', arg: OCARINA_FREQ[2] },
            { at: 4.2, sfx: 'note', arg: OCARINA_FREQ[2] }, { at: 4.8, sfx: 'note', arg: OCARINA_FREQ[0] },
            { at: 5.4, sfx: 'note', arg: OCARINA_FREQ[1] }, { at: 6.0, sfx: 'note', arg: OCARINA_FREQ[2] },
            { at: 6.6, sfx: 'correct' }, { at: 7.4, sfx: 'turn' }
        ]
    },
    {
        id: 'fases', chapter: 'final', label: 'Fin de fase', duration: 9.5,
        captions: [
            { at: 0, title: 'Fin de fase', text: 'Al acabar cada fase verás cómo va la clasificación.' },
            { at: 4.6, title: 'Siguiente fase', text: 'El anfitrión decide cuándo empieza la siguiente.' }
        ],
        cues: [
            { at: 0.2, sfx: 'whoosh' }, { at: 0.5, sfx: 'impact', arg: 0.6 }, { at: 2.6, sfx: 'tick', arg: 1.2 },
            { at: 2.7, sfx: 'coins' }, { at: 7.2, sfx: 'whoosh' }, { at: 7.45, sfx: 'impact', arg: 0.7 }
        ]
    },
    {
        id: 'podio', chapter: 'final', label: 'Podio', duration: 15,
        captions: [
            { at: 0, title: 'El podio', text: 'Al final se revela el podio… con suspense.' },
            { at: 3.4, title: '¿Empate por el 1º?', text: 'Ronda extra: tanda de penaltis. 5 preguntas cada uno, acierto = gol. Si siguen empatados, muerte súbita.' },
            { at: 7, title: 'Sin comodines', text: 'En los penaltis no hay comodines y los goles no suman puntos.' },
            { at: 11.2, title: '¡Campeona!', text: 'Otros empates del podio se deciden a cara o cruz o con una ruleta de nombres.' }
        ],
        cues: [
            { at: 0.2, sfx: 'impact' }, { at: 0.9, sfx: 'drumroll', arg: 2200 }, { at: 1.2, sfx: 'impact', arg: 0.5 },
            { at: 2.0, sfx: 'impact', arg: 0.6 }, { at: 3.4, sfx: 'impact' }, { at: 4.4, sfx: 'whistle' },
            ...[6.6, 7.0, 7.4, 7.8, 8.2, 8.6, 9.0, 9.4, 9.8, 10.2].map((at, i) => ({ at, sfx: 'tick' as const, arg: 1 + (i % 2) * 0.25 })),
            { at: 10.6, sfx: 'finalWhistle' }, { at: 11.2, sfx: 'fanfare' }, { at: 12.6, sfx: 'coinFlip', arg: 1.4 }, { at: 14.0, sfx: 'coinLand' }
        ]
    },
    {
        id: 'normas', chapter: 'final', label: 'Normas', duration: 10.5,
        captions: [
            { at: 0, title: 'Normas rápidas', text: 'Unas últimas cosas que conviene saber.' },
            { at: 0.4, title: 'Pausa', text: 'El anfitrión puede pausar la partida cuando quiera.' },
            { at: 2.4, title: '¿Se te cerró la app?', text: 'Vuelve a entrar: seguirás en la partida con tus puntos y tus comodines.' },
            { at: 4.4, title: 'Espectadores', text: 'Los espectadores ven la partida, pero no juegan.' },
            { at: 6.4, title: 'Comodines a medida', text: 'El anfitrión elige qué comodines hay, cuántos usos tienen… y puede devolvértelos.' },
            { at: 8.4, title: 'Lo importante', text: 'Escuchar al anfitrión, hablar claro… ¡y divertirse!' }
        ],
        cues: [0.4, 2.4, 4.4, 6.4, 8.4].map((at, i) => ({ at, sfx: 'tick' as const, arg: 0.9 + i * 0.1 }))
    },
    {
        id: 'outro', chapter: 'final', label: '¡A jugar!', duration: 5,
        captions: [
            { at: 0, title: '¡Ya sabes jugar!', text: 'Busca a tu anfitrión, pídele el código y únete a la sala.' }
        ],
        cues: [{ at: 0.2, sfx: 'impact' }, { at: 0.5, sfx: 'fanfare' }]
    }
];
