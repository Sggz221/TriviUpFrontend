/** Dificultad de una pregunta; null/ausente = sin clasificar. */
export type Dificultad = 'facil' | 'media' | 'dificil';

export const DIFICULTADES: { valor: Dificultad; etiqueta: string; color: string }[] = [
    { valor: 'facil', etiqueta: 'Fácil', color: 'var(--success)' },
    { valor: 'media', etiqueta: 'Media', color: 'var(--warning)' },
    { valor: 'dificil', etiqueta: 'Difícil', color: 'var(--error)' }
];

export function etiquetaDificultad(valor: string | null | undefined): string | null {
    return DIFICULTADES.find(d => d.valor === valor)?.etiqueta ?? null;
}

export function colorDificultad(valor: string | null | undefined): string {
    return DIFICULTADES.find(d => d.valor === valor)?.color ?? 'var(--neutral)';
}

export interface Respuesta {
    id: number;
    preguntaId: number;
    texto: string;
    esCorrecta: boolean;
}

/**
 * Tipo de pregunta: normal (por turnos), pulsador (responde el primer equipo en pulsar desde su móvil) o
 * colores (responde el que mejor imita un color al azar con tres sliders) u ocarina (responde el primero que
 * toca una melodía al azar con los botones de la ocarina).
 */
export type TipoPregunta = 'normal' | 'pulsador' | 'colores' | 'ocarina';

/** Tipos de pregunta especial (sin turno): se los lleva quien gana la prueba. */
export type TipoEspecial = Exclude<TipoPregunta, 'normal'>;

export const TIPOS_ESPECIALES: { valor: TipoEspecial; etiqueta: string; icono: string; badge: string; descripcion: string }[] = [
    { valor: 'pulsador', etiqueta: 'Pulsador', icono: '🔔', badge: 'badge-error', descripcion: 'Responde el primer equipo en pulsar desde su móvil' },
    { valor: 'colores', etiqueta: 'Colores', icono: '🎨', badge: 'badge-secondary', descripcion: 'Responde quien mejor imite un color al azar' },
    { valor: 'ocarina', etiqueta: 'Ocarina', icono: '🎵', badge: 'badge-info', descripcion: 'Responde el primero que toque la melodía' }
];

/** Datos para mostrar un tipo especial (null si es normal o no se indica). */
export function tipoEspecial(valor: string | null | undefined) {
    return TIPOS_ESPECIALES.find(t => t.valor === valor) ?? null;
}

export interface Pregunta {
    id: number;
    quizId: number;
    creatorId: number;
    numeroPregunta: number;
    enunciado: string;
    respuestas: Respuesta[];
    /** Fase (bloque) a la que pertenece, empezando en 1. */
    faseNumero?: number;
    /** Nombre libre de la fase (ronda, categoría, dificultad...). */
    faseNombre?: string | null;
    /** Color de la fase (#rrggbb); ausente = color por defecto según el número de fase. */
    faseColor?: string | null;
    /** Tipo de pregunta; ausente = normal. */
    tipo?: TipoPregunta;
    dificultad?: Dificultad | null;
    imagenUrl?: string | null;
    /** Dato curioso: en la partida solo lo ve el anfitrión, tras revelarse la respuesta. */
    curiosidad?: string | null;
}

export interface Cuestionario {
    id: number;
    nombre: string;
    esPublico: boolean;
    esBorrador?: boolean;
    /** Versión publicada actual (0 = nunca publicado). */
    version?: number;
    /** Un cuestionario publicado tiene un borrador pendiente aparte. */
    tieneBorrador?: boolean;
    gameCode: string;
    preguntas: Pregunta[];
    /** Fases con pool: sus preguntas salen, al jugarse, del banco de quien crea la sala. */
    pools?: FasePool[];
    creatorId: number;
    fechaCreacion: string;
    fechaActualizacion: string;
}

export interface CreateQuizRequest {
    nombre: string;
    esPublico: boolean;
    esBorrador?: boolean;
    preguntas: {
        numeroPregunta: number;
        enunciado: string;
        respuestas: { texto: string; esCorrecta: boolean }[];
        imagenUrl?: string;
        faseNumero: number;
        faseNombre?: string;
        faseColor?: string;
        tipo?: TipoPregunta;
        dificultad?: Dificultad;
        curiosidad?: string;
    }[];
    pools?: FasePool[];
}

/** De dónde salen las preguntas de un pool: elegidas a mano del banco o por filtros. */
export type OrigenPool = 'manual' | 'filtros';

/** Pregunta del banco elegida a mano para un pool (enunciado y tipo son solo para mostrarlos). */
export interface FasePoolPregunta {
    id: number;
    enunciado: string;
    tipo?: TipoPregunta | null;
}

/**
 * Fase sin preguntas fijas: en cada partida se juegan `cantidad` preguntas del banco de quien crea la sala.
 * Ocupa su número de fase igual que las fases de preguntas.
 */
export interface FasePool {
    faseNumero: number;
    faseNombre?: string | null;
    faseColor?: string | null;
    cantidad: number;
    origen: OrigenPool;
    /** Origen manual: preguntas del banco entre las que se sortea. */
    preguntas: FasePoolPregunta[];
    /** Origen por filtros: categoría (null = cualquiera). */
    categoriaId?: number | null;
    categoriaNombre?: string | null;
    /** Origen por filtros: dificultad (null = cualquiera). */
    dificultad?: Dificultad | null;
    /**
     * De las `cantidad` preguntas, cuántas son de cada tipo especial (salen del banco entre las de ese tipo);
     * el resto son normales.
     */
    pulsador?: number;
    colores?: number;
    ocarina?: number;
}

/** Preguntas normales (con turno) que saca un pool. */
export function normalesPool(pool: Pick<FasePool, 'cantidad' | TipoEspecial>): number {
    return Math.max(pool.cantidad - (pool.pulsador ?? 0) - (pool.colores ?? 0) - (pool.ocarina ?? 0), 0);
}

/** Reparto por tipos de un pool con especiales (p. ej. "3 normales, 1 🔔 Pulsador"); null si todas son normales. */
export function resumenTiposPool(pool: Pick<FasePool, 'cantidad' | TipoEspecial>): string | null {
    const especiales = TIPOS_ESPECIALES.filter(t => (pool[t.valor] ?? 0) > 0);
    if (especiales.length === 0) return null;
    const normales = normalesPool(pool);
    return [
        ...(normales > 0 ? [`${normales} normal${normales === 1 ? '' : 'es'}`] : []),
        ...especiales.map(t => `${pool[t.valor]} ${t.icono} ${t.etiqueta}`)
    ].join(', ');
}

export type UpdateQuizRequest = CreateQuizRequest;

export interface QuizVersion {
    numero: number | null;
    estado: 'Publicada' | 'Borrador' | 'Archivada';
    nombre: string;
    fecha: string;
}

export interface BancoRespuesta {
    texto: string;
    esCorrecta: boolean;
}

/** Pregunta guardada en el banco personal (no pertenece a ningún cuestionario). */
export interface BancoPregunta {
    id: number;
    enunciado: string;
    imagenUrl?: string | null;
    /** Dato curioso: en la partida solo lo ve el anfitrión, tras revelarse la respuesta. */
    curiosidad?: string | null;
    respuestas: BancoRespuesta[];
    dificultad?: Dificultad | null;
    /** Tipo con el que se juega, también al sacarla en un pool; ausente = normal. */
    tipo?: TipoPregunta;
    categoriaId?: number | null;
    categoriaNombre?: string | null;
    fechaCreacion: string;
    fechaActualizacion: string;
}

/** Para la categoría se indica `categoriaId` (existente) o `categoriaNombre` (se crea si no existe). */
export interface BancoPreguntaRequest {
    enunciado: string;
    imagenUrl?: string | null;
    curiosidad?: string | null;
    respuestas: BancoRespuesta[];
    dificultad?: Dificultad | null;
    tipo?: TipoPregunta;
    categoriaId?: number | null;
    categoriaNombre?: string | null;
}

export interface BancoPreguntaLista {
    preguntas: BancoPregunta[];
    totalCount: number;
}

export interface BancoFiltros {
    q?: string;
    categoriaId?: number | null;
    sinCategoria?: boolean;
    dificultad?: Dificultad | null;
    tipo?: TipoPregunta | null;
    page?: number;
    pageSize?: number;
}

/** Categoría del banco con el número de preguntas que contiene. */
export interface BancoCategoria {
    id: number;
    nombre: string;
    total: number;
}

export interface BancoCategorias {
    categorias: BancoCategoria[];
    /** Preguntas del banco que no tienen categoría. */
    sinCategoria: number;
}
