import { Component, input, output, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../../services/image.service';

@Component({
    selector: 'app-question-image-upload',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="flex flex-col items-center gap-3">
            <!-- Current Image Preview -->
            @if (displayedImageUrl()) {
                <div class="relative">
                    <img
                        [src]="getImageUrl(displayedImageUrl())"
                        alt="Imagen de pregunta"
                        class="rounded-lg max-w-[300px] max-h-[200px] object-cover shadow-md"
                    />
                    <!-- Delete button overlay -->
                    <button
                        type="button"
                        class="absolute -top-2 -right-2 btn btn-circle btn-sm btn-error"
                        (click)="removeImage()"
                        [disabled]="isDeleting()"
                    >
                        @if (isDeleting()) {
                            <span class="loading loading-spinner loading-xs"></span>
                        } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        }
                    </button>
                </div>
            }

            <!-- Upload area (hidden if there's already an image) -->
            @if (!displayedImageUrl()) {
                <label class="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed transition-all"
                       [style.border-color]="'var(--primary)'"
                       [style.background-color]="'var(--base-300)'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                         [style.color]="'var(--primary)'">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span class="text-sm opacity-70" style="color: var(--base-content);">
                        Añadir imagen (máx. 5MB)
                    </span>
                    <input
                        type="file"
                        accept="image/*"
                        (change)="onFileSelected($event)"
                        class="hidden"
                        #fileInput
                    />
                </label>
            }

            <!-- Selected image preview -->
            @if (selectedFile()) {
                <div class="text-center">
                    <p class="text-sm opacity-70 mb-1" style="color: var(--base-content);">
                        {{ selectedFile()?.name }}
                    </p>
                    <p class="text-xs opacity-50" style="color: var(--base-content);">
                        {{ formatFileSize(selectedFile()?.size ?? 0) }}
                    </p>
                </div>
            }

            <!-- Validation error -->
            @if (errorMessage()) {
                <div class="alert alert-error py-2 px-4 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {{ errorMessage() }}
                </div>
            }

            <!-- Upload progress -->
            @if (isUploading()) {
                <div class="w-full max-w-xs">
                    <progress class="progress progress-primary w-full" [value]="uploadProgress()" max="100"></progress>
                    <p class="text-xs text-center mt-1 opacity-70" style="color: var(--base-content);">
                        Subiendo... {{ uploadProgress() }}%
                    </p>
                </div>
            }

            <!-- Action buttons -->
            <div class="flex gap-2">
                @if (selectedFile() && !isUploading()) {
                    <button
                        (click)="uploadImage()"
                        class="btn btn-primary btn-sm"
                        [disabled]="!selectedFile() || isUploading()"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Subir imagen
                    </button>
                    <button
                        (click)="cancelSelection()"
                        class="btn btn-ghost btn-sm"
                    >
                        Cancelar
                    </button>
                }
            </div>

        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        label:hover {
            opacity: 0.9;
        }
    `]
})
export class QuestionImageUploadComponent {
    private imageService = inject(ImageService);

    currentImageUrl = input<string | null>(null);
    questionId = input<number | null>(null);

    imageChanged = output<string | null>();

    // Internal signal for displayed image (mutable)
    displayedImageUrl = signal<string | null>(null);
    selectedFile = signal<File | null>(null);
    isUploading = signal(false);
    isDeleting = signal(false);
    uploadProgress = signal(0);
    errorMessage = signal<string | null>(null);

    constructor() {
        // Sync displayedImageUrl with currentImageUrl input when it changes
        effect(() => {
            const inputUrl = this.currentImageUrl();
            if (inputUrl !== undefined) {
                this.displayedImageUrl.set(inputUrl);
            }
        });
    }

    private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) {
            return;
        }

        this.errorMessage.set(null);

        // Validate file type
        if (!this.ALLOWED_TYPES.includes(file.type)) {
            this.errorMessage.set('Por favor, selecciona una imagen válida (JPG, PNG, GIF o WebP)');
            return;
        }

        // Validate file size
        if (file.size > this.MAX_FILE_SIZE) {
            this.errorMessage.set('La imagen debe ser menor de 5MB');
            return;
        }

        this.selectedFile.set(file);
    }

    uploadImage(): void {
        const file = this.selectedFile();
        const qId = this.questionId();

        if (!file) {
            return;
        }

        if (qId === null) {
            this.errorMessage.set('ID de pregunta no disponible');
            return;
        }

        this.isUploading.set(true);
        this.uploadProgress.set(0);
        this.errorMessage.set(null);

        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
            const current = this.uploadProgress();
            if (current < 90) {
                this.uploadProgress.set(current + Math.random() * 15);
            }
        }, 200);

        this.imageService.uploadQuestionImage(qId, file).subscribe({
            next: (response) => {
                clearInterval(progressInterval);
                this.uploadProgress.set(100);

                setTimeout(() => {
                    this.isUploading.set(false);
                    this.selectedFile.set(null);
                    this.displayedImageUrl.set(response.imagenUrl);
                    this.imageChanged.emit(response.imagenUrl);
                }, 500);
            },
            error: (err) => {
                clearInterval(progressInterval);
                this.isUploading.set(false);
                this.uploadProgress.set(0);
                const errorMsg = err.error?.message || err.message || 'No se pudo subir la imagen. Inténtalo de nuevo.';
                this.errorMessage.set(errorMsg);
            }
        });
    }

    removeImage(): void {
        const qId = this.questionId();

        // If no questionId but there's a current image, just clear local state
        if (qId === null) {
            this.displayedImageUrl.set(null);
            this.imageChanged.emit(null);
            return;
        }

        this.isDeleting.set(true);
        this.errorMessage.set(null);

        this.imageService.deleteQuestionImage(qId).subscribe({
            next: () => {
                this.isDeleting.set(false);
                this.displayedImageUrl.set(null);
                this.imageChanged.emit(null);
            },
            error: (err) => {
                this.isDeleting.set(false);
                const errorMsg = err.error?.message || err.message || 'No se pudo eliminar la imagen. Inténtalo de nuevo.';
                this.errorMessage.set(errorMsg);
            }
        });
    }

    cancelSelection(): void {
        // If there's an uploaded image, remove it from server
        if (this.displayedImageUrl()) {
            this.removeImage();
            return;
        }

        // Otherwise just clear local selection
        this.selectedFile.set(null);
        this.errorMessage.set(null);
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getImageUrl(url: string | null): string {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        // Transformar /uploads/... a /storage/... para nginx proxy
        if (url.startsWith('/uploads')) {
            return url.replace('/uploads', '/storage');
        }
        return url;
    }
}
