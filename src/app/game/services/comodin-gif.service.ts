import { Injectable } from '@angular/core';
import { ComodinTipo } from '../models/game.models';
import { COMODIN_GIF_PREFIX } from '../components/comodin-hand/comodin-cards';

/**
 * GIFs que acompañan al aviso de comodín. Viven en public/gifs/comodines como PREFIJO_n.gif y no hay
 * listado: se cuentan probando _1, _2… hasta el primero que no carga (el servidor devuelve index.html
 * para lo que no existe, por eso se prueba con <img> y no por el código HTTP).
 */
@Injectable({ providedIn: 'root' })
export class ComodinGifService {
    private static readonly DIR = 'gifs/comodines';
    private static readonly MAX = 30;
    private counts = new Map<ComodinTipo, Promise<number>>();

    /** Cuenta (y deja en caché del navegador) los GIFs de todos los comodines. */
    preloadAll(): void {
        (Object.keys(COMODIN_GIF_PREFIX) as ComodinTipo[]).forEach(tipo => this.count(tipo));
    }

    /** URL de un GIF al azar del comodín, o null si no tiene ninguno. */
    async randomGif(tipo: ComodinTipo): Promise<string | null> {
        const total = await this.count(tipo);
        return total > 0 ? this.url(tipo, 1 + Math.floor(Math.random() * total)) : null;
    }

    private count(tipo: ComodinTipo): Promise<number> {
        let total = this.counts.get(tipo);
        if (!total) {
            total = this.probe(tipo);
            this.counts.set(tipo, total);
        }
        return total;
    }

    private async probe(tipo: ComodinTipo): Promise<number> {
        let n = 0;
        while (n < ComodinGifService.MAX && await this.loads(this.url(tipo, n + 1))) n++;
        return n;
    }

    private loads(src: string): Promise<boolean> {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
        });
    }

    private url(tipo: ComodinTipo, n: number): string {
        return `${ComodinGifService.DIR}/${COMODIN_GIF_PREFIX[tipo]}_${n}.gif`;
    }
}
