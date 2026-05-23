import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService, AuthUser } from '../../../auth/auth.service';
import { UserService } from '../../../services/user.service';
import { ProfilePhotoUploadComponent } from '../../../shared/components/profile-photo-upload/profile-photo-upload';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterLink, ProfilePhotoUploadComponent],
    template: `
        <div class="min-h-screen py-8" style="background-color: var(--base-100);">
            <div class="container mx-auto px-4 max-w-2xl">
                <!-- Header -->
                <div class="mb-8 flex justify-between items-center">
                    <div>
                        <a routerLink="/" class="btn btn-ghost btn-sm mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Volver al inicio
                        </a>
                        <h1 class="text-3xl font-bold" style="color: var(--base-content);">Mi Perfil</h1>
                    </div>
                    <!-- Edit Profile Button -->
                    <a routerLink="/perfil/editar" class="btn btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar Perfil
                    </a>
                </div>

                <!-- Error/Success Messages -->
                @if (errorMessage()) {
                    <div class="alert alert-error mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{{ errorMessage() }}</span>
                    </div>
                }

                @if (successMessage()) {
                    <div class="alert alert-success mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{{ successMessage() }}</span>
                    </div>
                }

                <!-- Profile Card -->
                <div class="card shadow-xl" style="background-color: var(--base-200);">
                    <div class="card-body items-center text-center">
                        <!-- Photo Section with Delete Option -->
                        <div class="flex flex-col items-center gap-4">
                            <app-profile-photo-upload
                                [currentPhotoUrl]="currentUser()?.profilePhotoUrl ?? null"
                                [username]="currentUser()?.username ?? ''"
                                (photoUpdated)="onPhotoUpdated($event)"
                            />

                            <!-- Delete Photo Button (only if has photo) -->
                            @if (currentUser()?.profilePhotoUrl) {
                                <button
                                    (click)="confirmDeletePhoto()"
                                    class="btn btn-ghost btn-sm text-error"
                                    [disabled]="isDeletingPhoto()"
                                >
                                    @if (isDeletingPhoto()) {
                                        <span class="loading loading-spinner loading-xs"></span>
                                        Eliminando...
                                    } @else {
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Eliminar foto de perfil
                                    }
                                </button>
                            }
                        </div>

                        <!-- User Info -->
                        <div class="mt-6 w-full">
                            <div class="flex flex-col gap-4">
                                <!-- Username -->
                                <div class="flex items-center justify-between p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <div class="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span class="font-medium" style="color: var(--base-content);">Usuario</span>
                                    </div>
                                    <span class="font-semibold" style="color: var(--primary);">
                                        {{ currentUser()?.username }}
                                    </span>
                                </div>

                                <!-- Email -->
                                <div class="flex items-center justify-between p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <div class="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span class="font-medium" style="color: var(--base-content);">Email</span>
                                    </div>
                                    <span class="font-semibold" style="color: var(--primary);">
                                        {{ currentUser()?.email }}
                                    </span>
                                </div>

                                <!-- Role -->
                                <div class="flex items-center justify-between p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <div class="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span class="font-medium" style="color: var(--base-content);">Rol</span>
                                    </div>
                                    <span class="badge badge-primary badge-outline font-semibold">
                                        {{ currentUser()?.role }}
                                    </span>
                                </div>

                                <!-- Member Since -->
                                <div class="flex items-center justify-between p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <div class="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span class="font-medium" style="color: var(--base-content);">Miembro desde</span>
                                    </div>
                                    <span class="font-semibold" style="color: var(--base-content);">
                                        {{ formatDate(currentUser()?.createdAt) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="mt-8">
                    <h2 class="text-xl font-bold mb-4" style="color: var(--base-content);">Acciones rápidas</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <a routerLink="/cuestionarios/mis-cuestionarios" class="btn btn-outline" style="border-color: var(--primary); color: var(--primary);">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Mis cuestionarios
                        </a>
                        <a routerLink="/cuestionarios/crear" class="btn btn-outline" style="border-color: var(--secondary); color: var(--secondary);">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Crear cuestionario
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Photo Confirmation Dialog -->
        @if (showDeleteDialog()) {
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div class="card shadow-xl w-full max-w-sm" style="background-color: var(--base-200);">
                    <div class="card-body">
                        <h3 class="text-lg font-bold" style="color: var(--base-content);">Eliminar foto de perfil</h3>
                        <p class="py-4" style="color: var(--base-content);">
                            ¿Estás seguro de que quieres eliminar tu foto de perfil? Esta acción no se puede deshacer.
                        </p>
                        <div class="flex justify-end gap-2">
                            <button (click)="cancelDeletePhoto()" class="btn btn-ghost">
                                Cancelar
                            </button>
                            <button (click)="deletePhoto()" class="btn btn-error">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        }
    `,
    styles: [`
        :host {
            display: block;
        }
    `]
})
export class Profile implements OnInit {
    private authService = inject(AuthService);
    private userService = inject(UserService);
    private router = inject(Router);

    currentUser = signal<AuthUser | null>(null);
    isDeletingPhoto = signal(false);
    showDeleteDialog = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    ngOnInit(): void {
        this.loadUser();
    }

    loadUser(): void {
        this.currentUser.set(this.authService.getUser());
    }

    onPhotoUpdated(newPhotoUrl: string): void {
        this.loadUser();
        this.successMessage.set('¡Foto de perfil actualizada!');
        setTimeout(() => this.successMessage.set(null), 3000);
    }

    confirmDeletePhoto(): void {
        this.showDeleteDialog.set(true);
    }

    cancelDeletePhoto(): void {
        this.showDeleteDialog.set(false);
    }

    deletePhoto(): void {
        this.isDeletingPhoto.set(true);
        this.showDeleteDialog.set(false);
        this.errorMessage.set(null);

        this.userService.deleteProfilePhoto().subscribe({
            next: () => {
                this.isDeletingPhoto.set(false);
                this.loadUser();
                this.successMessage.set('Foto de perfil eliminada');
                setTimeout(() => this.successMessage.set(null), 3000);
            },
            error: (err) => {
                this.isDeletingPhoto.set(false);
                this.errorMessage.set(
                    err.error?.message || 'No se pudo eliminar la foto. Inténtalo de nuevo.'
                );
            }
        });
    }

    formatDate(dateString: string | undefined): string {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}
