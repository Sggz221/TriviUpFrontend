import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthUser } from '../../../auth/auth.service';
import { UserService } from '../../../services/user.service';
import { ProfilePhotoUploadComponent } from '../../../shared/components/profile-photo-upload/profile-photo-upload';

@Component({
    selector: 'app-profile-edit',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, ProfilePhotoUploadComponent],
    template: `
        <div class="min-h-screen py-8" style="background-color: var(--base-100);">
            <div class="container mx-auto px-4 max-w-2xl">
                <!-- Header -->
                <div class="mb-8">
                    <a routerLink="/perfil" class="btn btn-ghost btn-sm mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Volver al perfil
                    </a>
                    <h1 class="text-3xl font-bold" style="color: var(--base-content);">Editar Perfil</h1>
                </div>

                <!-- Success Alert -->
                @if (successMessage()) {
                    <div class="alert alert-success mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{{ successMessage() }}</span>
                    </div>
                }

                <!-- Error Alert -->
                @if (errorMessage()) {
                    <div class="alert alert-error mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{{ errorMessage() }}</span>
                    </div>
                }

                <!-- Edit Form Card -->
                <div class="card shadow-xl" style="background-color: var(--base-200);">
                    <div class="card-body">
                        <form (ngSubmit)="onSubmit()" #profileForm="ngForm" class="flex flex-col gap-6">
                            <!-- Profile Photo Section -->
                            <div class="flex flex-col items-center gap-4 pb-6 border-b" style="border-color: var(--base-300);">
                                <app-profile-photo-upload
                                    [currentPhotoUrl]="currentUser()?.profilePhotoUrl ?? null"
                                    [username]="currentUser()?.username ?? ''"
                                    [editable]="true"
                                    (photoUpdated)="onPhotoUpdated($event)"
                                />
                            </div>

                            <!-- Username -->
                            <div class="form-control w-full">
                                <label class="label">
                                    <span class="label-text font-medium" style="color: var(--base-content);">Nombre de usuario</span>
                                </label>
                                <input
                                    type="text"
                                    name="username"
                                    [(ngModel)]="formData.username"
                                    required
                                    minlength="3"
                                    maxlength="50"
                                    pattern="^[a-zA-Z0-9_]+$"
                                    class="input input-bordered w-full"
                                    [class.input-error]="usernameField.invalid && usernameField.touched"
                                    style="background-color: var(--base-300); color: var(--base-content);"
                                    #usernameField="ngModel"
                                />
                                @if (usernameField.invalid && usernameField.touched) {
                                    <label class="label">
                                        @if (usernameField.errors?.['required']) {
                                            <span class="label-text-alt text-error">El nombre de usuario es obligatorio</span>
                                        }
                                        @if (usernameField.errors?.['minlength']) {
                                            <span class="label-text-alt text-error">El nombre debe tener al menos 3 caracteres</span>
                                        }
                                        @if (usernameField.errors?.['maxlength']) {
                                            <span class="label-text-alt text-error">El nombre no puede exceder 50 caracteres</span>
                                        }
                                        @if (usernameField.errors?.['pattern']) {
                                            <span class="label-text-alt text-error">Solo letras, números y guiones bajos</span>
                                        }
                                    </label>
                                }
                            </div>

                            <!-- Email -->
                            <div class="form-control w-full">
                                <label class="label">
                                    <span class="label-text font-medium" style="color: var(--base-content);">Correo electrónico</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    [(ngModel)]="formData.email"
                                    required
                                    email
                                    class="input input-bordered w-full"
                                    [class.input-error]="emailField.invalid && emailField.touched"
                                    style="background-color: var(--base-300); color: var(--base-content);"
                                    #emailField="ngModel"
                                />
                                @if (emailField.invalid && emailField.touched) {
                                    <label class="label">
                                        @if (emailField.errors?.['required']) {
                                            <span class="label-text-alt text-error">El correo es obligatorio</span>
                                        }
                                        @if (emailField.errors?.['email']) {
                                            <span class="label-text-alt text-error">Introduce un correo válido</span>
                                        }
                                    </label>
                                }
                            </div>

                            <!-- Password Section -->
                            <div class="pt-4 border-t" style="border-color: var(--base-300);">
                                <h3 class="text-lg font-semibold mb-4" style="color: var(--base-content);">
                                    Cambiar contraseña
                                </h3>
                                <p class="text-sm opacity-70 mb-4" style="color: var(--base-content);">
                                    Deja los campos vacíos si no quieres cambiar la contraseña
                                </p>

                                <!-- New Password -->
                                <div class="form-control w-full mb-4">
                                    <label class="label">
                                        <span class="label-text font-medium" style="color: var(--base-content);">Nueva contraseña</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        [(ngModel)]="formData.password"
                                        minlength="4"
                                        class="input input-bordered w-full"
                                        [class.input-error]="passwordField.invalid && passwordField.touched"
                                        style="background-color: var(--base-300); color: var(--base-content);"
                                        #passwordField="ngModel"
                                    />
                                    @if (passwordField.invalid && passwordField.touched) {
                                        <label class="label">
                                            @if (passwordField.errors?.['minlength']) {
                                                <span class="label-text-alt text-error">La contraseña debe tener al menos 4 caracteres</span>
                                            }
                                        </label>
                                    }
                                </div>

                                <!-- Confirm Password -->
                                <div class="form-control w-full">
                                    <label class="label">
                                        <span class="label-text font-medium" style="color: var(--base-content);">Confirmar contraseña</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        [(ngModel)]="formData.confirmPassword"
                                        class="input input-bordered w-full"
                                        [class.input-error]="confirmPasswordField.invalid && confirmPasswordField.touched"
                                        style="background-color: var(--base-300); color: var(--base-content);"
                                        #confirmPasswordField="ngModel"
                                    />
                                    @if (confirmPasswordField.invalid && confirmPasswordField.touched) {
                                        <label class="label">
                                            @if (formData.password && !formData.confirmPassword) {
                                                <span class="label-text-alt text-error">Confirma la contraseña</span>
                                            }
                                        </label>
                                    }
                                    @if (formData.password !== formData.confirmPassword && formData.confirmPassword && confirmPasswordField.touched) {
                                        <label class="label">
                                            <span class="label-text-alt text-error">Las contraseñas no coinciden</span>
                                        </label>
                                    }
                                </div>
                            </div>

                            <!-- Form Actions -->
                            <div class="flex justify-end gap-3 pt-4">
                                <a routerLink="/perfil" class="btn btn-ghost">
                                    Cancelar
                                </a>
                                <button
                                    type="submit"
                                    class="btn btn-primary"
                                    [disabled]="isLoading() || !isFormValid()"
                                >
                                    @if (isLoading()) {
                                        <span class="loading loading-spinner loading-sm"></span>
                                        Guardando...
                                    } @else {
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Guardar cambios
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .input-error {
            border-color: var(--error) !important;
        }
    `]
})
export class ProfileEdit implements OnInit {
    private authService = inject(AuthService);
    private userService = inject(UserService);
    private router = inject(Router);

    currentUser = signal<AuthUser | null>(null);
    isLoading = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    formData = {
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    };

    ngOnInit(): void {
        this.loadUser();
    }

    loadUser(): void {
        const user = this.authService.getUser();
        this.currentUser.set(user);
        if (user) {
            this.formData.username = user.username;
            this.formData.email = user.email;
        }
    }

    isFormValid(): boolean {
        const usernameValid = this.formData.username.length >= 3 &&
                              this.formData.username.length <= 50 &&
                              /^[a-zA-Z0-9_]+$/.test(this.formData.username);

        const emailValid = this.formData.email.length > 0 &&
                           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email);

        const passwordValid = this.formData.password.length === 0 ||
                              this.formData.password.length >= 4;

        const confirmValid = this.formData.password === this.formData.confirmPassword ||
                            (this.formData.password.length === 0 && this.formData.confirmPassword.length === 0);

        return usernameValid && emailValid && passwordValid && confirmValid;
    }

    onSubmit(): void {
        if (!this.isFormValid()) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        const updateData: { username?: string; email?: string; password?: string } = {};

        if (this.formData.username !== this.currentUser()?.username) {
            updateData.username = this.formData.username;
        }
        if (this.formData.email !== this.currentUser()?.email) {
            updateData.email = this.formData.email;
        }
        if (this.formData.password.length >= 4) {
            updateData.password = this.formData.password;
        }

        // If nothing to update
        if (Object.keys(updateData).length === 0) {
            this.isLoading.set(false);
            this.successMessage.set('No hay cambios que guardar');
            setTimeout(() => {
                this.router.navigate(['/perfil']);
            }, 1500);
            return;
        }

        this.userService.updateProfile(updateData).subscribe({
            next: (updatedUser) => {
                console.log('[ProfileEdit] API Response:', updatedUser);
                console.log('[ProfileEdit] currentUser before update:', this.currentUser());
                console.log('[ProfileEdit] formData before clearing:', this.formData);

                this.isLoading.set(false);
                this.successMessage.set('¡Perfil actualizado correctamente!');

                // Clear password fields
                this.formData.password = '';
                this.formData.confirmPassword = '';

                console.log('[ProfileEdit] Navigating to /perfil');

                setTimeout(() => {
                    this.router.navigate(['/perfil']);
                }, 1500);
            },
            error: (err) => {
                this.isLoading.set(false);
                this.errorMessage.set(
                    err.error?.message ||
                    err.error?.errors?.Password?.[0] ||
                    'No se pudo actualizar el perfil. Inténtalo de nuevo.'
                );
            }
        });
    }

    onPhotoUpdated(newPhotoUrl: string): void {
        this.loadUser();
    }
}
