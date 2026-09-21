import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BancoCategoria } from '../../../cuestionarios/models/cuestionario.model';

/** Categoría elegida: una existente (`categoriaId`) o el nombre de una nueva (`categoriaNombre`); ambas null = sin categoría. */
export interface CategoriaElegida {
    categoriaId: number | null;
    categoriaNombre: string | null;
}

const OPCION_NUEVA = '__nueva__';

/**
 * Selector de categoría del banco: elige una existente, ninguna, o crea una nueva escribiendo su nombre.
 * Sugiere ponerle categoría cuando no hay ninguna elegida.
 */
@Component({
    selector: 'app-categoria-selector',
    standalone: true,
    imports: [FormsModule],
    template: `
        <div class="flex flex-col gap-2">
            <select class="select select-bordered select-sm w-full"
                    aria-label="Categoría"
                    [ngModel]="valorSelect()"
                    (ngModelChange)="onSelect($event)">
                <option value="">Sin categoría</option>
                @for (c of categorias(); track c.id) {
                    <option [value]="c.id">{{ c.nombre }} ({{ c.total }})</option>
                }
                <option [value]="opcionNueva">+ Nueva categoría…</option>
            </select>

            @if (modoNueva()) {
                <input type="text"
                       class="input input-bordered input-sm w-full"
                       maxlength="50"
                       placeholder="Nombre de la nueva categoría"
                       aria-label="Nombre de la nueva categoría"
                       [ngModel]="categoriaNombre() ?? ''"
                       (ngModelChange)="onNombre($event)" />
                @if (coincidencia(); as existente) {
                    <p class="text-xs" style="color: var(--info);">Ya tienes «{{ existente.nombre }}»: se usará esa.</p>
                }
            } @else if (sugerir() && !categoriaId()) {
                <p class="text-xs opacity-70">
                    @if (categorias().length === 0) {
                        Aún no tienes categorías: elige «Nueva categoría…» para crear la primera y encontrar luego esta pregunta.
                    } @else {
                        Ponle una categoría para encontrarla luego en tu banco.
                    }
                </p>
            }
        </div>
    `
})
export class CategoriaSelectorComponent {
    categorias = input<BancoCategoria[]>([]);
    categoriaId = input<number | null | undefined>(null);
    categoriaNombre = input<string | null | undefined>(null);
    /** Muestra la sugerencia de categorizar cuando no hay ninguna elegida. */
    sugerir = input(true);
    cambio = output<CategoriaElegida>();

    readonly opcionNueva = OPCION_NUEVA;
    private creando = signal(false);

    modoNueva = computed(() => this.creando() || (!!this.categoriaNombre() && !this.categoriaId()));

    valorSelect = computed(() => this.modoNueva() ? OPCION_NUEVA : (this.categoriaId() ? String(this.categoriaId()) : ''));

    /** Categoría existente cuyo nombre coincide (sin distinguir mayúsculas) con el que se está escribiendo. */
    coincidencia = computed(() => {
        const escrito = (this.categoriaNombre() ?? '').trim().toLowerCase();
        return escrito ? this.categorias().find(c => c.nombre.toLowerCase() === escrito) ?? null : null;
    });

    onSelect(valor: string): void {
        if (valor === OPCION_NUEVA) {
            this.creando.set(true);
            this.cambio.emit({ categoriaId: null, categoriaNombre: this.categoriaNombre() ?? '' });
            return;
        }

        this.creando.set(false);
        this.cambio.emit({ categoriaId: valor ? Number(valor) : null, categoriaNombre: null });
    }

    onNombre(nombre: string): void {
        this.cambio.emit({ categoriaId: null, categoriaNombre: nombre });
    }
}
