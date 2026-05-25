import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
    selector: 'app-contacto',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, NavbarComponent],
    template: `
        <app-navbar></app-navbar>
        <div class="min-h-screen py-12 px-4" style="background-color: var(--base-100);">
            <div class="max-w-2xl mx-auto">
                <!-- Back button -->
                <a routerLink="/" class="btn btn-ghost btn-sm mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Volver al inicio
                </a>

                <h1 class="text-4xl font-bold mb-2" style="color: var(--base-content);">Contacto</h1>
                <p class="mb-8" style="color: var(--base-content); opacity: 80%;">
                    ¿Tienes alguna pregunta o sugerencia? Estamos aquí para ayudarte.
                </p>

                <!-- Success Message -->
                @if (submitted()) {
                    <div class="alert alert-success mb-8">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>¡Mensaje enviado con éxito! Te responderemos pronto.</span>
                    </div>
                }

                <!-- Contact Form -->
                <div class="card shadow-xl" style="background-color: var(--base-200);">
                    <div class="card-body">
                        <form (ngSubmit)="onSubmit()" class="space-y-6">
                            <!-- Name -->
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text font-medium" style="color: var(--base-content);">Nombre</span>
                                </label>
                                <input
                                    type="text"
                                    [(ngModel)]="formData.name"
                                    name="name"
                                    placeholder="Tu nombre"
                                    class="input input-bordered w-full"
                                    style="background-color: var(--base-300); border-color: var(--base-300); color: var(--base-content);"
                                    required
                                />
                            </div>

                            <!-- Email -->
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text font-medium" style="color: var(--base-content);">Correo electrónico</span>
                                </label>
                                <input
                                    type="email"
                                    [(ngModel)]="formData.email"
                                    name="email"
                                    placeholder="tu@email.com"
                                    class="input input-bordered w-full"
                                    style="background-color: var(--base-300); border-color: var(--base-300); color: var(--base-content);"
                                    required
                                />
                            </div>

                            <!-- Subject -->
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text font-medium" style="color: var(--base-content);">Asunto</span>
                                </label>
                                <select
                                    [(ngModel)]="formData.subject"
                                    name="subject"
                                    class="select select-bordered w-full"
                                    style="background-color: var(--base-300); border-color: var(--base-300); color: var(--base-content);"
                                    required
                                >
                                    <option value="" disabled selected>Selecciona una opción</option>
                                    <option value="sugerencia">Sugerencia</option>
                                    <option value="bug">Reportar un error</option>
                                    <option value="ayuda">Necesito ayuda</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>

                            <!-- Message -->
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text font-medium" style="color: var(--base-content);">Mensaje</span>
                                </label>
                                <textarea
                                    [(ngModel)]="formData.message"
                                    name="message"
                                    placeholder="¿En qué podemos ayudarte?"
                                    class="textarea textarea-bordered w-full h-32"
                                    style="background-color: var(--base-300); border-color: var(--base-300); color: var(--base-content);"
                                    required
                                ></textarea>
                            </div>

                            <!-- Submit -->
                            <button
                                type="submit"
                                class="btn btn-primary w-full"
                                [disabled]="isSubmitting()"
                            >
                                @if (isSubmitting()) {
                                    <span class="loading loading-spinner loading-sm"></span>
                                    Enviando...
                                } @else {
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    Enviar mensaje
                                }
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Alternative contact -->
                <div class="mt-8 text-center">
                    <p class="mb-4" style="color: var(--base-content); opacity: 60%;">También puedes contactarnos a través de:</p>
                    <div class="flex justify-center gap-4">
                        <a href="mailto:contacto&#64;triviup.com" class="flex items-center gap-2 btn btn-ghost btn-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            contacto&#64;triviup.com
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .textarea::placeholder,
        .input::placeholder {
            color: var(--base-content);
            opacity: 0.4;
        }
    `]
})
export class ContactoComponent {
    formData = {
        name: '',
        email: '',
        subject: '',
        message: ''
    };

    isSubmitting = signal(false);
    submitted = signal(false);

    onSubmit(): void {
        if (!this.formData.name || !this.formData.email || !this.formData.subject || !this.formData.message) {
            return;
        }

        this.isSubmitting.set(true);

        // Simulate sending (since there's no backend endpoint for this)
        setTimeout(() => {
            this.isSubmitting.set(false);
            this.submitted.set(true);
            this.formData = { name: '', email: '', subject: '', message: '' };

            // Reset success message after 5 seconds
            setTimeout(() => this.submitted.set(false), 5000);
        }, 1500);
    }
}