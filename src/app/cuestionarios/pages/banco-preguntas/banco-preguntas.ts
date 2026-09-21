import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BancoPreguntasService } from '../../services/banco-preguntas.service';
import { CuestionarioService } from '../../services/cuestionario.service';
import { BancoPregunta, EtiquetaCount } from '../../models/cuestionario.model';
import { imageUrl } from '../../../shared/utils/image-url.utils';

/** Pregunta que se está creando o editando en el formulario. */
interface Editor {
    id: number | null;
    enunciado: string;
    respuestas: { texto: string; esCorrecta: boolean }[];
    /** Etiquetas separadas por comas. */
    etiquetas: string;
    imagenUrl: string | null;
    subiendoImagen: boolean;
}

@Component({
    selector: 'app-banco-preguntas',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './banco-preguntas.html'
})
export class BancoPreguntasPage implements OnInit {
    private bancoService = inject(BancoPreguntasService);
    private cuestionarioService = inject(CuestionarioService);

    private static readonly PAGE_SIZE = 20;

    preguntas = signal<BancoPregunta[]>([]);
    total = signal(0);
    etiquetas = signal<EtiquetaCount[]>([]);
    pagina = signal(1);
    busqueda = signal('');
    etiquetaActiva = signal<string | null>(null);
    cargando = signal(false);
    guardando = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    editor: Editor | null = null;

    private temporizador: ReturnType<typeof setTimeout> | null = null;

    readonly imageUrl = imageUrl;

    get totalPaginas(): number {
        return Math.max(1, Math.ceil(this.total() / BancoPreguntasPage.PAGE_SIZE));
    }

    ngOnInit(): void {
        this.cargarEtiquetas();
        this.cargar();
    }

    onBusqueda(valor: string): void {
        this.busqueda.set(valor);
        if (this.temporizador) clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => {
            this.pagina.set(1);
            this.cargar();
        }, 300);
    }

    elegirEtiqueta(etiqueta: string | null): void {
        this.etiquetaActiva.set(etiqueta);
        this.pagina.set(1);
        this.cargar();
    }

    irAPagina(pagina: number): void {
        if (pagina < 1 || pagina > this.totalPaginas) return;
        this.pagina.set(pagina);
        this.cargar();
    }

    private cargar(): void {
        this.cargando.set(true);
        this.bancoService.listar({
            q: this.busqueda().trim() || undefined,
            etiqueta: this.etiquetaActiva() ?? undefined,
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

    private cargarEtiquetas(): void {
        this.bancoService.obtenerEtiquetas().subscribe({
            next: (e) => {
                this.etiquetas.set(e);
                // Si la etiqueta filtrada ya no existe (se borró su última pregunta), quitar el filtro
                const activa = this.etiquetaActiva();
                if (activa && !e.some(x => x.etiqueta === activa)) {
                    this.etiquetaActiva.set(null);
                }
            },
            error: () => this.etiquetas.set([])
        });
    }

    // ===== Editor =====

    nueva(): void {
        this.errorMessage.set(null);
        this.editor = {
            id: null,
            enunciado: '',
            respuestas: [{ texto: '', esCorrecta: true }, { texto: '', esCorrecta: false }],
            etiquetas: this.etiquetaActiva() ?? '',
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
            etiquetas: pregunta.etiquetas.join(', '),
            imagenUrl: pregunta.imagenUrl ?? null,
            subiendoImagen: false
        };
    }

    cancelar(): void {
        this.editor = null;
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
            etiquetas: editor.etiquetas.split(',').map(e => e.trim()).filter(e => e.length > 0)
        };

        this.guardando.set(true);
        this.errorMessage.set(null);
        const llamada = editor.id === null
            ? this.bancoService.crear(request)
            : this.bancoService.actualizar(editor.id, request);

        llamada.subscribe({
            next: () => {
                this.guardando.set(false);
                this.editor = null;
                this.avisar(editor.id === null ? 'Pregunta añadida al banco.' : 'Pregunta actualizada.');
                this.cargarEtiquetas();
                this.cargar();
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
                this.cargarEtiquetas();
                // Si era la única de la última página, retroceder una
                if (this.preguntas().length === 1 && this.pagina() > 1) {
                    this.pagina.update(p => p - 1);
                }
                this.cargar();
            },
            error: (err) => this.errorMessage.set(err.error?.message || 'No se pudo eliminar la pregunta.')
        });
    }

    private avisar(mensaje: string): void {
        this.successMessage.set(mensaje);
        setTimeout(() => this.successMessage.set(null), 3000);
    }
}
