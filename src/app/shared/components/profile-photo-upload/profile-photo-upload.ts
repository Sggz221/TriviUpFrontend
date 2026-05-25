import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user.service';
import { ProfilePhotoComponent, ProfilePhotoSize } from '../profile-photo/profile-photo';

@Component({
    selector: 'app-profile-photo-upload',
    standalone: true,
    imports: [CommonModule, ProfilePhotoComponent],
    template: `
        <div class="flex flex-col items-center gap-4">
            <!-- Current Photo Preview -->
            <div class="relative">
                <app-profile-photo
                    [photoUrl]="currentPhotoUrl()"
                    [username]="username()"
                    size="lg"
                    [showInitials]="!currentPhotoUrl()"
                />

                <!-- Upload overlay on hover (only in edit mode) -->
                @if (editable()) {
                    <label class="absolute inset-0 cursor-pointer rounded-full overflow-hidden group">
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            (change)="onFileSelected($event)"
                            class="hidden"
                            #fileInput
                        />
                    </label>
                }
            </div>

            <!-- Hidden file input for programmatic access -->
            <input
                type="file"
                accept="image/*"
                (change)="onFileSelected($event)"
                class="hidden"
                #hiddenFileInput
            />

            <!-- Selected image preview -->
            @if (selectedFile()) {
                <div class="text-center">
                    <p class="text-sm opacity-70 mb-2" style="color: var(--base-content);">
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

            <!-- Action buttons (only in edit mode) -->
            @if (editable()) {
                <div class="flex gap-2">
                    @if (selectedFile() && !isUploading()) {
                        <button
                            (click)="uploadPhoto()"
                            class="btn btn-primary btn-sm"
                            [disabled]="!selectedFile() || isUploading()"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Subir foto
                        </button>
                        <button
                            (click)="cancelSelection()"
                            class="btn btn-ghost btn-sm"
                        >
                            Cancelar
                        </button>
                    }
                </div>
            }

            <!-- Success message -->
            @if (successMessage()) {
                <div class="alert alert-success py-2 px-4 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ successMessage() }}
                </div>
            }

            <!-- Help text (only in edit mode) -->
            @if (editable() && !selectedFile() && !isUploading()) {
                <p class="text-xs opacity-50" style="color: var(--base-content);">
                    Haz clic en la foto para cambiar • Máx. 5MB • JPG, PNG, GIF, WebP
                </p>
            }
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }
    `]
})
export class ProfilePhotoUploadComponent {
    private userService = inject(UserService);

    currentPhotoUrl = input<string | null>(null);
    username = input<string>('');
    size = input<ProfilePhotoSize>('md');
    editable = input<boolean>(false); // Only allow photo changes in edit mode

    photoUpdated = output<string>();

    selectedFile = signal<File | null>(null);
    isUploading = signal(false);
    uploadProgress = signal(0);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    onFileSelected(event: Event): void {
        console.log('[ProfilePhotoUpload] onFileSelected - event:', event);
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        console.log('[ProfilePhotoUpload] archivo seleccionado:', file?.name, file?.type, file?.size);

        if (!file) {
            console.log('[ProfilePhotoUpload] No hay archivo');
            return;
        }

        this.errorMessage.set(null);
        this.successMessage.set(null);

        // Validate file type
        if (!this.ALLOWED_TYPES.includes(file.type)) {
            console.log('[ProfilePhotoUpload] Tipo no válido:', file.type);
            this.errorMessage.set('Por favor, selecciona una imagen válida (JPG, PNG, GIF o WebP)');
            return;
        }

        // Validate file size
        if (file.size > this.MAX_FILE_SIZE) {
            console.log('[ProfilePhotoUpload] Tamaño excesivo:', file.size);
            this.errorMessage.set('La imagen debe ser menor de 5MB');
            return;
        }

        console.log('[ProfilePhotoUpload] Archivo válido, guardando en selectedFile');
        this.selectedFile.set(file);
    }

    uploadPhoto(): void {
        const file = this.selectedFile();
        console.log('[ProfilePhotoUpload] uploadPhoto - archivo:', file?.name);
        if (!file) {
            console.log('[ProfilePhotoUpload] uploadPhoto - No hay archivo seleccionado');
            return;
        }

        this.isUploading.set(true);
        this.uploadProgress.set(0);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        // Simulate progress for better UX since HttpClient progress events can be tricky
        const progressInterval = setInterval(() => {
            const current = this.uploadProgress();
            if (current < 90) {
                this.uploadProgress.set(current + Math.random() * 15);
            }
        }, 200);

        console.log('[ProfilePhotoUpload] Llamando a userService.updateProfilePhoto');
        this.userService.updateProfilePhoto(file).subscribe({
            next: (response) => {
                console.log('[ProfilePhotoUpload] Upload exitoso, response:', response);
                clearInterval(progressInterval);
                this.uploadProgress.set(100);

                setTimeout(() => {
                    this.isUploading.set(false);
                    this.selectedFile.set(null);
                    this.successMessage.set('¡Foto de perfil actualizada!');
                    this.photoUpdated.emit(response.profilePhotoUrl);

                    // Clear success message after 3 seconds
                    setTimeout(() => {
                        this.successMessage.set(null);
                    }, 3000);
                }, 500);
            },
            error: (err) => {
                console.log('[ProfilePhotoUpload] Error en upload:', err);
                console.log('[ProfilePhotoUpload] Error status:', err.status);
                console.log('[ProfilePhotoUpload] Error message:', err.message);
                console.log('[ProfilePhotoUpload] Error error:', err.error);
                clearInterval(progressInterval);
                this.isUploading.set(false);
                this.uploadProgress.set(0);
                const errorMsg = err.error?.message || err.message || 'No se pudo subir la foto. Inténtalo de nuevo.';
                console.log('[ProfilePhotoUpload] Mensaje de error mostrado:', errorMsg);
                this.errorMessage.set(errorMsg);
            }
        });
    }

    cancelSelection(): void {
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
}
