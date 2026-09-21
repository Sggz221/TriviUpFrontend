import { Component, OnInit, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BancoPreguntasService } from '../../services/banco-preguntas.service';
import { BancoCategoriasService } from '../../services/banco-categorias.service';
import {
    BancoCategoria, BancoPregunta, DIFICULTADES, Dificultad, colorDificultad, etiquetaDificultad
} from '../../models/cuestionario.model';

/** Filtro de categoría del selector: todas, una concreta o solo las que no tienen. */
type FiltroCategoria = { tipo: 'todas' } | { tipo: 'sin' } | { tipo: 'categoria'; id: number };

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

            <div class="flex flex-wrap items-center gap-2 mb-2">
                <button type="button" class="badge badge-lg cursor-pointer"
                        [class.badge-info]="esFiltro('todas')" [class.badge-outline]="!esFiltro('todas')"
                        (click)="elegirFiltro({ tipo: 'todas' })">Todas</button>
                @for (c of categorias(); track c.id) {
                    <button type="button" class="badge badge-lg cursor-pointer"
                            [class.badge-info]="esFiltro('categoria', c.id)" [class.badge-outline]="!esFiltro('categoria', c.id)"
                            (click)="elegirFiltro({ tipo: 'categoria', id: c.id })">{{ c.nombre }} · {{ c.total }}</button>
                }
                @if (sinCategoria() > 0) {
                    <button type="button" class="badge badge-lg cursor-pointer"
                            [class.badge-info]="esFiltro('sin')" [class.badge-outline]="!esFiltro('sin')"
                            (click)="elegirFiltro({ tipo: 'sin' })">Sin categoría · {{ sinCategoria() }}</button>
                }
            </div>

            <div class="flex flex-wrap items-center gap-1 mb-3" role="group" aria-label="Filtrar por dificultad">
                <span class="text-xs opacity-70 mr-1">Dificultad:</span>
                @for (d of dificultades; track d.valor) {
                    <button type="button" class="badge cursor-pointer"
                            [style.background-color]="dificultadActiva() === d.valor ? d.color : 'transparent'"
                            [style.color]="dificultadActiva() === d.valor ? 'var(--base-100)' : d.color"
                            [style.border]="'1px solid ' + d.color"
                            (click)="elegirDificultad(d.valor)">{{ d.etiqueta }}</button>
                }
            </div>

            @if (cargando()) {
                <div class="flex justify-center py-4"><span class="loading loading-spinner"></span></div>
            } @else if (error()) {
                <p class="text-sm" style="color: var(--error);">{{ error() }}</p>
            } @else if (preguntas().length === 0) {
                <p class="text-sm opacity-70 py-2">
                    @if (hayFiltros()) {
                        No hay preguntas con esos filtros.
                    } @else {
                        Tu banco está vacío. Guarda preguntas con «Al banco» o créalas en
                        <a routerLink="/banco-preguntas" class="link" style="color: var(--info);">tu banco de preguntas</a>.
                    }
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
                                    <span class="flex flex-wrap items-center gap-1 mt-1">
                                        <span class="text-xs opacity-70">{{ p.respuestas.length }} respuestas</span>
                                        @if (p.categoriaNombre) {
                                            <span class="badge badge-sm badge-info">{{ p.categoriaNombre }}</span>
                                        } @else {
                                            <span class="badge badge-sm badge-outline opacity-70">Sin categoría</span>
                                        }
                                        @if (p.dificultad) {
                                            <span class="badge badge-sm" style="color: var(--base-100);"
                                                  [style.background-color]="colorDificultad(p.dificultad)">{{ etiquetaDificultad(p.dificultad) }}</span>
                                        }
                                    </span>
                                </span>
                            </label>
                        </li>
                    }
                </ul>
            }

            @if (sinCategoria() > 0 && !esFiltro('sin')) {
                <p class="text-xs mt-2 opacity-80">
                    Tienes {{ sinCategoria() }} pregunta(s) sin categoría.
                    <a routerLink="/banco-preguntas" class="link" style="color: var(--info);">Clasifícalas en tu banco</a> para encontrarlas mejor.
                </p>
            }

            <div class="flex items-center justify-between gap-3 mt-3">
                <span class="text-xs opacity-70">Se copian al cuestionario, con su dificultad: editarlas aquí no cambia tu banco.</span>
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
    private categoriasService = inject(BancoCategoriasService);

    agregar = output<BancoPregunta[]>();
    cerrar = output<void>();

    busqueda = signal('');
    filtro = signal<FiltroCategoria>({ tipo: 'todas' });
    dificultadActiva = signal<Dificultad | null>(null);
    categorias = signal<BancoCategoria[]>([]);
    sinCategoria = signal(0);
    preguntas = signal<BancoPregunta[]>([]);
    seleccion = signal<Map<number, BancoPregunta>>(new Map());
    cargando = signal(false);
    error = signal<string | null>(null);

    readonly dificultades = DIFICULTADES;
    readonly etiquetaDificultad = etiquetaDificultad;
    readonly colorDificultad = colorDificultad;

    private temporizador: ReturnType<typeof setTimeout> | null = null;

    ngOnInit(): void {
        this.categoriasService.listar().subscribe({
            next: (r) => {
                this.categorias.set(r.categorias);
                this.sinCategoria.set(r.sinCategoria);
            },
            error: () => this.categorias.set([])
        });
        this.cargar();
    }

    esFiltro(tipo: FiltroCategoria['tipo'], id?: number): boolean {
        const f = this.filtro();
        return f.tipo === tipo && (f.tipo !== 'categoria' || f.id === id);
    }

    hayFiltros(): boolean {
        return !!this.busqueda().trim() || !!this.dificultadActiva() || !this.esFiltro('todas');
    }

    onBusqueda(valor: string): void {
        this.busqueda.set(valor);
        if (this.temporizador) clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => this.cargar(), 300);
    }

    elegirFiltro(filtro: FiltroCategoria): void {
        this.filtro.set(filtro);
        this.cargar();
    }

    elegirDificultad(d: Dificultad): void {
        this.dificultadActiva.set(this.dificultadActiva() === d ? null : d);
        this.cargar();
    }

    private cargar(): void {
        this.cargando.set(true);
        this.error.set(null);
        const f = this.filtro();
        this.bancoService.listar({
            q: this.busqueda().trim() || undefined,
            categoriaId: f.tipo === 'categoria' ? f.id : null,
            sinCategoria: f.tipo === 'sin',
            dificultad: this.dificultadActiva(),
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
