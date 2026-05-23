import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-qr-display',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './qr-display.html',
    styleUrls: ['./qr-display.css']
})
export class QrDisplayComponent {
    @Input({ required: true }) data!: string;
    @Input() size: number = 250;
    @Input() downloadFilename: string = 'qr-code';

    isLoading = signal(true);
    hasError = signal(false);

    // Usar API externa para generar el QR (no requiere librería)
    qrImageUrl = computed(() => {
        if (!this.data) return '';
        return `https://api.qrserver.com/v1/create-qr-code/?size=${this.size}x${this.size}&data=${encodeURIComponent(this.data)}`;
    });

    constructor() {
        // La imagen carga via URL, simulamos loading
        setTimeout(() => this.isLoading.set(false), 500);
    }

    onImageLoad(): void {
        this.isLoading.set(false);
        this.hasError.set(false);
    }

    onImageError(): void {
        this.isLoading.set(false);
        this.hasError.set(true);
    }

    descargarQr(): void {
        const link = document.createElement('a');
        link.download = this.downloadFilename;
        link.href = this.qrImageUrl();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
