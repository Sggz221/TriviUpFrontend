import { Component, input, output } from '@angular/core';
import { DIFICULTADES, Dificultad } from '../../../cuestionarios/models/cuestionario.model';

/**
 * Selector de dificultad (fácil / media / difícil). Volver a pulsar la opción activa la deja sin clasificar.
 */
@Component({
    selector: 'app-dificultad-selector',
    standalone: true,
    template: `
        <div class="flex flex-wrap items-center gap-1" role="radiogroup" [attr.aria-label]="'Dificultad'">
            @for (d of dificultades; track d.valor) {
                <button type="button"
                        class="badge cursor-pointer select-none px-3 py-3"
                        role="radio"
                        [attr.aria-checked]="valor() === d.valor"
                        [style.background-color]="valor() === d.valor ? d.color : 'transparent'"
                        [style.color]="valor() === d.valor ? 'var(--base-100)' : d.color"
                        [style.border]="'1px solid ' + d.color"
                        (click)="elegir(d.valor)">
                    {{ d.etiqueta }}
                </button>
            }
            @if (!valor()) {
                <span class="text-xs opacity-60 ml-1">Sin clasificar</span>
            }
        </div>
    `
})
export class DificultadSelectorComponent {
    valor = input<Dificultad | null | undefined>(null);
    cambio = output<Dificultad | null>();

    readonly dificultades = DIFICULTADES;

    elegir(valor: Dificultad): void {
        this.cambio.emit(this.valor() === valor ? null : valor);
    }
}
