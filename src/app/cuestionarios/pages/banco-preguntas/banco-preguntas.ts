import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BancoPreguntasService } from '../../services/banco-preguntas.service';
import { BancoCategoriasService } from '../../services/banco-categorias.service';
import { CuestionarioService } from '../../services/cuestionario.service';
import {
    BancoCategoria, BancoPregunta, DIFICULTADES, Dificultad, colorDificultad, etiquetaDificultad
} from '../../models/cuestionario.model';
import { imageUrl } from '../../../shared/utils/image-url.utils';
import { CategoriaElegida, CategoriaSelectorComponent } from '../../../shared/components/categoria-selector/categoria-selector';
import { DificultadSelectorComponent } from '../../../shared/components/dificultad-selector/dificultad-selector';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

/** Pregunta que se está creando o editando en el formulario. */
interface Editor {
    id: number | null;
    enunciado: string;
    respuestas: { texto: string; esCorrecta: boolean }[];
    categoriaId: number | null;
    /** Nombre de una categoría nueva (se crea al guardar). */
    categoriaNombre: string | null;
    dificultad: Dificultad | null;
    imagenUrl: string | null;
    subiendoImagen: boolean;
}

/** Filtro de categoría activo: todas, una concreta o solo las que no tienen. */
type FiltroCategoria = { tipo: 'todas' } | { tipo: 'sin' } | { tipo: 'categoria'; id: number };

@Component({
    selector: 'app-banco-preguntas',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, CategoriaSelectorComponent, DificultadSelectorComponent],
    templateUrl: './banco-preguntas.html'
})
export class BancoPreguntasPage implements OnInit {
    private bancoService = inject(BancoPreguntasService);
    private categoriasService = inject(BancoCategoriasService);
    private cuestionarioService = inject(CuestionarioService);

    private static readonly PAGE_SIZE = 20;

    preguntas = signal<BancoPregunta[]>([]);
    total = signal(0);
    categorias = signal<BancoCategoria[]>([]);
    sinCategoria = signal(0);
    filtro = signal<FiltroCategoria>({ tipo: 'todas' });
    dificultadActiva = signal<Dificultad | null>(null);
    pagina = signal(1);
    busqueda = signal('');
    cargando = signal(false);
    guardando = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    /** Gestión de categorías: alta y renombrado en línea. */
    creandoCategoria = signal(false);
    nombreNuevaCategoria = '';
    renombrando = signal(false);
    nombreRenombrado = '';

    /** Modo selección para mover preguntas a otra categoría. */
    seleccionando = signal(false);
    seleccion = signal<Set<number>>(new Set());
    destinoMover: string = '';

    editor: Editor | null = null;

    private temporizador: ReturnType<typeof setTimeout> | null = null;

    readonly imageUrl = imageUrl;
    readonly dificultades = DIFICULTADES;
    readonly etiquetaDificultad = etiquetaDificultad;
    readonly colorDificultad = colorDificultad;

    /** Categoría seleccionada en el filtro (null si es "Todas" o "Sin categoría"). */
    categoriaActiva = computed<BancoCategoria | null>(() => {
        const f = this.filtro();
        return f.tipo === 'categoria' ? this.categorias().find(c => c.id === f.id) ?? null : null;
    });

    totalPreguntasBanco = computed(() => this.categorias().reduce((s, c) => s + c.total, 0) + this.sinCategoria());

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.total() / BancoPreguntasPage.PAGE_SIZE));
    }

    ngOnInit(): void {
        this.cargarCategorias();
        this.cargar();
    }

    // ===== Carga =====

    private cargar(): void {
        this.cargando.set(true);
        const f = this.filtro();
        this.bancoService.listar({
            q: this.busqueda().trim() || undefined,
            categoriaId: f.tipo === 'categoria' ? f.id : null,
            sinCategoria: f.tipo === 'sin',
            dificultad: this.dificultadActiva(),
            page: this.pagina(),
            pageSize: BancoPreguntasPage.PAGE_SIZE
        }).subscribe({
            next: (lista) => {
                this.preguntas.set(lista.preguntas);
                this.total.set(lista.totalCount);
                this.cargando.set(false);
            },
            error: () => {
                this.cargando.set(false);
                this.errorMessage.set('No se pudo cargar tu banco de preguntas.');
            }
        });
    }

    private cargarCategorias(): void {
        this.categoriasService.listar().subscribe({
            next: (r) => {
                this.categorias.set(r.categorias);
                this.sinCategoria.set(r.sinCategoria);
                // Si la categoría filtrada ya no existe (se borró), volver a "Todas"
                const f = this.filtro();
                if (f.tipo === 'categoria' && !r.categorias.some(c => c.id === f.id)) {
                    this.filtro.set({ tipo: 'todas' });
                    this.cargar();
                }
            },
            error: () => { /* el listado de preguntas informa del error */ }
        });
    }

    private refrescar(): void {
        this.cargarCategorias();
        this.cargar();
    }

    // ===== Filtros =====

    onBusqueda(valor: string): void {
        this.busqueda.set(valor);
        if (this.temporizador) clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => {
            this.pagina.set(1);
            this.cargar();
        }, 300);
    }

    elegirFiltro(filtro: FiltroCategoria): void {
        this.filtro.set(filtro);
        this.renombrando.set(false);
        this.seleccion.set(new Set());
        this.pagina.set(1);
        this.cargar();
    }

    esFiltro(tipo: FiltroCategoria['tipo'], id?: number): boolean {
        const f = this.filtro();
        return f.tipo === tipo && (f.tipo !== 'categoria' || f.id === id);
    }

    elegirDificultad(d: Dificultad | null): void {
        this.dificultadActiva.set(this.dificultadActiva() === d ? null : d);
        this.pagina.set(1);
        this.cargar();
    }

    irAPagina(pagina: number): void {
        if (pagina < 1 || pagina > this.totalPaginas) return;
        this.pagina.set(pagina);
        this.cargar();
    }

    /** Atajo de la sugerencia: mostrar las preguntas sin categoría listas para clasificar. */
    clasificarSinCategoria(): void {
        this.elegirFiltro({ tipo: 'sin' });
        this.seleccionando.set(true);
    }

    // ===== Categorías =====

    empezarCategoria(): void {
        this.nombreNuevaCategoria = '';
        this.creandoCategoria.set(true);
        this.errorMessage.set(null);
    }

    crearCategoria(): void {
        const nombre = this.nombreNuevaCategoria.trim();
        if (!nombre) return;

        this.categoriasService.crear(nombre).subscribe({
            next: (c) => {
                this.creandoCategoria.set(false);
                this.avisar(`Categoría «${c.nombre}» creada.`);
                this.categorias.update(lista => [...lista, c].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                this.elegirFiltro({ tipo: 'categoria', id: c.id });
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo crear la categoría.')
        });
    }

    empezarRenombrar(): void {
        const categoria = this.categoriaActiva();
        if (!categoria) return;
        this.nombreRenombrado = categoria.nombre;
        this.renombrando.set(true);
        this.errorMessage.set(null);
    }

    renombrarCategoria(): void {
        const categoria = this.categoriaActiva();
        const nombre = this.nombreRenombrado.trim();
        if (!categoria || !nombre) return;

        this.categoriasService.renombrar(categoria.id, nombre).subscribe({
            next: () => {
                this.renombrando.set(false);
                this.avisar('Categoría renombrada.');
                this.refrescar();
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo renombrar la categoría.')
        });
    }

    eliminarCategoria(): void {
        const categoria = this.categoriaActiva();
        if (!categoria) return;
        if (!confirm(`¿Eliminar la categoría «${categoria.nombre}»? Sus ${categoria.total} preguntas no se borran: quedan sin categoría.`)) return;

        this.categoriasService.eliminar(categoria.id).subscribe({
            next: () => {
                this.avisar('Categoría eliminada.');
                this.filtro.set({ tipo: 'todas' });
                this.pagina.set(1);
                this.refrescar();
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo eliminar la categoría.')
        });
    }

    // ===== Selección y mover =====

    alternarSeleccion(): void {
        this.seleccionando.update(v => !v);
        this.seleccion.set(new Set());
        this.destinoMover = '';
    }

    alternarPregunta(id: number): void {
        const nueva = new Set(this.seleccion());
        if (nueva.has(id)) nueva.delete(id); else nueva.add(id);
        this.seleccion.set(nueva);
    }

    seleccionarTodasLasVisibles(): void {
        const todas = this.preguntas().map(p => p.id);
        const todasYa = todas.every(id => this.seleccion().has(id));
        this.seleccion.set(todasYa ? new Set() : new Set(todas));
    }

    /** Mueve las preguntas seleccionadas al destino elegido ('' = quitar la categoría, número = esa categoría). */
    moverSeleccion(): void {
        const ids = [...this.seleccion()];
        if (ids.length === 0) return;
        const destino = this.destinoMover === '' ? null : Number(this.destinoMover);

        this.bancoService.asignarCategoria(ids, destino).subscribe({
            next: (r) => {
                const nombre = this.categorias().find(c => c.id === destino)?.nombre;
                this.avisar(destino === null
                    ? `${r.actualizadas} pregunta(s) sin categoría.`
                    : `${r.actualizadas} pregunta(s) movida(s) a «${nombre}».`);
                this.seleccion.set(new Set());
                this.destinoMover = '';
                this.refrescar();
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudieron mover las preguntas.')
        });
    }

    // ===== Editor =====

    /** Nueva pregunta; con una categoría activa en el filtro se crea directamente dentro de ella. */
    nueva(): void {
        this.errorMessage.set(null);
        this.editor = {
            id: null,
            enunciado: '',
            respuestas: [{ texto: '', esCorrecta: true }, { texto: '', esCorrecta: false }],
            categoriaId: this.categoriaActiva()?.id ?? null,
            categoriaNombre: null,
            dificultad: this.dificultadActiva(),
            imagenUrl: null,
            subiendoImagen: false
        };
    }

    editar(pregunta: BancoPregunta): void {
        this.errorMessage.set(null);
        this.editor = {
            id: pregunta.id,
            enunciado: pregunta.enunciado,
            respuestas: pregunta.respuestas.map(r => ({ ...r })),
            categoriaId: pregunta.categoriaId ?? null,
            categoriaNombre: null,
            dificultad: pregunta.dificultad ?? null,
            imagenUrl: pregunta.imagenUrl ?? null,
            subiendoImagen: false
        };
    }

    cancelar(): void {
        this.editor = null;
    }

    onCategoria(elegida: CategoriaElegida): void {
        if (!this.editor) return;
        this.editor.categoriaId = elegida.categoriaId;
        this.editor.categoriaNombre = elegida.categoriaNombre;
    }

    agregarRespuesta(): void {
        if (this.editor && this.editor.respuestas.length < 4) {
            this.editor.respuestas.push({ texto: '', esCorrecta: false });
        }
    }

    quitarRespuesta(index: number): void {
        if (!this.editor || this.editor.respuestas.length <= 2) return;
        const eraCorrecta = this.editor.respuestas[index].esCorrecta;
        this.editor.respuestas.splice(index, 1);
        if (eraCorrecta) {
            this.editor.respuestas[0].esCorrecta = true;
        }
    }

    marcarCorrecta(index: number): void {
        this.editor?.respuestas.forEach((r, i) => r.esCorrecta = i === index);
    }

    onImagenElegida(event: Event): void {
        const editor = this.editor;
        const archivo = (event.target as HTMLInputElement).files?.[0];
        if (!editor || !archivo) return;

        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(archivo.type)) {
            this.errorMessage.set('Selecciona una imagen válida (JPG, PNG, GIF o WebP).');
            return;
        }
        if (archivo.size > 5 * 1024 * 1024) {
            this.errorMessage.set('La imagen debe ser menor de 5MB.');
            return;
        }

        editor.subiendoImagen = true;
        this.cuestionarioService.subirImagenPregunta(archivo).subscribe({
            next: (resp) => {
                editor.imagenUrl = resp.path;
                editor.subiendoImagen = false;
            },
            error: () => {
                editor.subiendoImagen = false;
                this.errorMessage.set('No se pudo subir la imagen. Inténtalo de nuevo.');
            }
        });
    }

    quitarImagen(): void {
        if (this.editor) this.editor.imagenUrl = null;
    }

    guardar(): void {
        const editor = this.editor;
        if (!editor || this.guardando()) return;

        const enunciado = editor.enunciado.trim();
        if (!enunciado) {
            this.errorMessage.set('Escribe el enunciado de la pregunta.');
            return;
        }
        if (editor.respuestas.some(r => !r.texto.trim())) {
            this.errorMessage.set('Todas las respuestas deben tener texto.');
            return;
        }
        if (editor.respuestas.filter(r => r.esCorrecta).length !== 1) {
            this.errorMessage.set('Marca exactamente una respuesta correcta.');
            return;
        }

        const request = {
            enunciado,
            imagenUrl: editor.imagenUrl,
            respuestas: editor.respuestas.map(r => ({ texto: r.texto.trim(), esCorrecta: r.esCorrecta })),
            dificultad: editor.dificultad,
            categoriaId: editor.categoriaId,
            categoriaNombre: editor.categoriaId ? null : (editor.categoriaNombre?.trim() || null)
        };

        this.guardando.set(true);
        this.errorMessage.set(null);
        const llamada = editor.id === null
            ? this.bancoService.crear(request)
            : this.bancoService.actualizar(editor.id, request);

        llamada.subscribe({
            next: (guardada) => {
                this.guardando.set(false);
                this.editor = null;
                const dondeQueda = guardada.categoriaNombre ? ` en «${guardada.categoriaNombre}»` : ' sin categoría';
                this.avisar(editor.id === null ? `Pregunta añadida${dondeQueda}.` : 'Pregunta actualizada.');
                this.refrescar();
            },
            error: (err) => {
                this.guardando.set(false);
                this.errorMessage.set(err.error?.message || 'No se pudo guardar la pregunta.');
            }
        });
    }

    eliminar(pregunta: BancoPregunta): void {
        if (!confirm('¿Eliminar esta pregunta del banco? Las copias que ya están en cuestionarios no se tocan.')) return;

        this.bancoService.eliminar(pregunta.id).subscribe({
            next: () => {
                this.avisar('Pregunta eliminada.');
                // Si era la única de la última página, retroceder una
                if (this.preguntas().length === 1 && this.pagina() > 1) {
                    this.pagina.update(p => p - 1);
                }
                this.refrescar();
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo eliminar la pregunta.')
        });
    }

    private avisar(mensaje: string): void {
        this.successMessage.set(mensaje);
        setTimeout(() => this.successMessage.set(null), 3500);
    }
}
