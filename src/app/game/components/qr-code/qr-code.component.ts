import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-qr-code',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './qr-code.component.html',
    styleUrl: './qr-code.component.scss'
})
export class QrCodeComponent {
    @Input({ required: true }) set url(value: string) {
        this.urlSignal.set(value);
    }

    @Input() size = 200;
    @Input() darkColor = '#000000';
    @Input() lightColor = '#ffffff';

    urlSignal = signal<string>('');

    qrCodeUrl = computed(() => {
        const baseUrl = 'https://api.qrserver.com/v1/create-qr-code/';
        const params = new URLSearchParams({
            size: `${this.size}x${this.size}`,
            data: this.urlSignal(),
            color: this.darkColor.replace('#', ''),
            bgcolor: this.lightColor.replace('#', '')
        });
        return `${baseUrl}?${params.toString()}`;
    });

    errorMessage = signal<string | null>(null);

    onImageError(): void {
        this.errorMessage.set('Failed to generate QR code');
    }

    onImageLoad(): void {
        this.errorMessage.set(null);
    }
}
