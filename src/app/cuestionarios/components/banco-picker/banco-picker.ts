import { Component, OnInit, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BancoPreguntasService } from '../../services/banco-preguntas.service';
import { BancoPregunta, EtiquetaCount } from '../../models/cuestionario.model';

/**
 * Selector de preguntas del banco personal para el builder de cuestionarios.
 * Emite las preguntas elegidas; quien lo usa decide cómo copiarlas.
 */
@Component({
    selector: 'app-banco-picker',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
        <div class="rounded-xl p-3 sm:p-4 mt-4" style="background-color: var(--base-300);">
            <div class="flex flex-wrap items-center gap-2 mb-3">
                <input type="search"
                       class="input input-bordered input-sm flex-1 min-w-[10rem]"
                       placeholder="Buscar en tu banco..."
                       [ngModel]="busqueda()"
                       (ngModelChange)="onBusqueda($event)" />
                <button type="button" class="btn btn-sm btn-ghost" (click)="cerrar.emit()">Cerrar</button>
            </div>

            @if (etiquetas().length > 0) {
                <div class="flex flex-wrap gap-2 mb-3">
                    <button type="button"
                            class="badge badge-lg cursor-pointer"
                            [class.badge-info]="!etiquetaActiva()"
                            [class.badge-outline]="!!etiquetaActiva()"
                            (click)="elegirEtiqueta(null)">Todas</button>
                    @for (e of etiquetas(); track e.etiqueta) {
                        <button type="button"
                                class="badge badge-lg cursor-pointer"
                                [class.badge-info]="etiquetaActiva() === e.etiqueta"
                                [class.badge-outline]="etiquetaActiva() !== e.etiqueta"
                                (click)="elegirEtiqueta(e.etiqueta)">{{ e.etiqueta }} · {{ e.total }}</button>
                    }
                </div>
            }

            @if (cargando()) {
                <div class="flex justify-center py-4"><span class="loading loading-spinner"></span></div>
            } @else if (error()) {
                <p class="text-sm" style="color: var(--error);">{{ error() }}</p>
            } @else if (preguntas().length === 0) {
                <p class="text-sm opacity-70 py-2">
                    No hay preguntas que coincidan.
                    <a routerLink="/banco-preguntas" class="link" style="color: var(--info);">Ir a tu banco</a>
                </p>
            } @else {
                <ul class="space-y-2 max-h-72 overflow-y-auto pr-1">
                    @for (p of preguntas(); track p.id) {
                        <li>
                            <label class="flex items-start gap-3 p-2 rounded-lg cursor-pointer" style="background-color: var(--base-100);">
                                <input type="checkbox" class="checkbox checkbox-sm mt-1 shrink-0"
                                       [checked]="seleccion().has(p.id)"
                                       (change)="alternar(p)" />
                                <span class="min-w-0 flex-1">
                                    <span class="block text-sm font-medium break-words">{{ p.enunciado }}</span>
                                    <span class="block text-xs opacity-70">{{ p.respuestas.length }} respuestas</span>
                                    @if (p.etiquetas.length > 0) {
                                        <span class="flex flex-wrap gap-1 mt-1">
                                            @for (t of p.etiquetas; track t) {
                                                <span class="badge badge-sm badge-outline">{{ t }}</span>
                                            }
                                        </span>
                                    }
                                </span>
                            </label>
                        </li>
                    }
                </ul>
            }

            <div class="flex items-center justify-between gap-3 mt-3">
                <span class="text-xs opacity-70">Se copian al cuestionario: editarlas aquí no cambia tu banco.</span>
                <button type="button" class="btn btn-sm btn-primary"
                        [disabled]="seleccion().size === 0"
                        (click)="confirmar()">
                    Añadir seleccionadas ({{ seleccion().size }})
                </button>
            </div>
        </div>
    `
})
export class BancoPickerComponent implements OnInit {
    private bancoService = inject(BancoPreguntasService);

    agregar = output<BancoPregunta[]>();
    cerrar = output<void>();

    busqueda = signal('');
    etiquetaActiva = signal<string | null>(null);
    etiquetas = signal<EtiquetaCount[]>([]);
    preguntas = signal<BancoPregunta[]>([]);
    seleccion = signal<Map<number, BancoPregunta>>(new Map());
    cargando = signal(false);
    error = signal<string | null>(null);

    private temporizador: ReturnType<typeof setTimeout> | null = null;

    ngOnInit(): void {
        this.bancoService.obtenerEtiquetas().subscribe({
            next: (e) => this.etiquetas.set(e),
            error: () => this.etiquetas.set([])
        });
        this.cargar();
    }

    onBusqueda(valor: string): void {
        this.busqueda.set(valor);
        if (this.temporizador) clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => this.cargar(), 300);
    }

    elegirEtiqueta(etiqueta: string | null): void {
        this.etiquetaActiva.set(etiqueta);
        this.cargar();
    }

    private cargar(): void {
        this.cargando.set(true);
        this.error.set(null);
        this.bancoService.listar({
            q: this.busqueda().trim() || undefined,
            etiqueta: this.etiquetaActiva() ?? undefined,
            pageSize: 50
        }).subscribe({
            next: (lista) => {
                this.preguntas.set(lista.preguntas);
                this.cargando.set(false);
            },
            error: () => {
                this.cargando.set(false);
                this.error.set('No se pudo cargar tu banco de preguntas.');
            }
        });
    }

    alternar(pregunta: BancoPregunta): void {
        const nueva = new Map(this.seleccion());
        if (nueva.has(pregunta.id)) {
            nueva.delete(pregunta.id);
        } else {
            nueva.set(pregunta.id, pregunta);
        }
        this.seleccion.set(nueva);
    }

    confirmar(): void {
        this.agregar.emit([...this.seleccion().values()]);
        this.seleccion.set(new Map());
    }
}
