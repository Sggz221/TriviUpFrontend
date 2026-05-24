import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
    selector: 'app-informacion',
    standalone: true,
    imports: [CommonModule, RouterLink, NavbarComponent],
    template: `
        <app-navbar></app-navbar>
        <div class="min-h-screen py-12 px-4" style="background-color: var(--base-100);">
            <div class="max-w-3xl mx-auto">
                <!-- Back button -->
                <a routerLink="/" class="btn btn-ghost btn-sm mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Volver al inicio
                </a>

                <h1 class="text-4xl font-bold mb-8" style="color: var(--base-content);">Información</h1>

                <div class="space-y-8">
                    <!-- About Section -->
                    <div class="card shadow-xl" style="background-color: var(--base-200);">
                        <div class="card-body">
                            <h2 class="card-title text-2xl mb-4" style="color: var(--primary);">Acerca de TriviUp</h2>
                            <p class="mb-4" style="color: var(--base-content);">
                                TriviUp es una plataforma de trivia en tiempo real donde puedes crear, compartir y jugar concursos de preguntas
                                con amigos, familiares o cualquier persona del mundo.
                            </p>
                            <p style="color: var(--base-content);">
                                Nuestra misión es hacer que el aprendizaje sea divertido, ofreciendo una experiencia interactiva y competitiva
                                que fomenta el conocimiento a través del juego.
                            </p>
                        </div>
                    </div>

                    <!-- How it Works -->
                    <div class="card shadow-xl" style="background-color: var(--base-200);">
                        <div class="card-body">
                            <h2 class="card-title text-2xl mb-4" style="color: var(--primary);">¿Cómo funciona?</h2>
                            <div class="space-y-4">
                                <div class="flex gap-4 items-start">
                                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: var(--primary); color: var(--primary-content);">
                                        <span class="font-bold">1</span>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold mb-1" style="color: var(--base-content);">Crea un cuestionario</h3>
                                        <p style="color: var(--base-content); opacity: 80%;">Diseña tus propias preguntas o importa categorías predefinidas.</p>
                                    </div>
                                </div>
                                <div class="flex gap-4 items-start">
                                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: var(--secondary); color: var(--secondary-content);">
                                        <span class="font-bold">2</span>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold mb-1" style="color: var(--base-content);">Crea una sala</h3>
                                        <p style="color: var(--base-content); opacity: 80%;">Genera un código único para que otros se unan a tu partida.</p>
                                    </div>
                                </div>
                                <div class="flex gap-4 items-start">
                                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: var(--accent);">
                                        <span class="font-bold text-white">3</span>
                                    </div>
                                    <div>
                                        <h3 class="font-semibold mb-1" style="color: var(--base-content);">Juega en tiempo real</h3>
                                        <p style="color: var(--base-content); opacity: 80%;">Compite con otros jugadores y демuestra tu conocimiento.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Features -->
                    <div class="card shadow-xl" style="background-color: var(--base-200);">
                        <div class="card-body">
                            <h2 class="card-title text-2xl mb-4" style="color: var(--primary);">Características</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <h3 class="font-semibold mb-2" style="color: var(--base-content);">Cuestionarios personalizados</h3>
                                    <p class="text-sm" style="color: var(--base-content); opacity: 80%;">Crea tus propias preguntas y categorías.</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <h3 class="font-semibold mb-2" style="color: var(--base-content);">Partidas en tiempo real</h3>
                                    <p class="text-sm" style="color: var(--base-content); opacity: 80%;">Juega simultáneamente con múltiples jugadores.</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <h3 class="font-semibold mb-2" style="color: var(--base-content);">Sistema de ranking</h3>
                                    <p class="text-sm" style="color: var(--base-content); opacity: 80%;">Sube posiciones y compara tus puntuaciones.</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background-color: var(--base-300);">
                                    <h3 class="font-semibold mb-2" style="color: var(--base-content);">Explora cuestionarios</h3>
                                    <p class="text-sm" style="color: var(--base-content); opacity: 80%;">Descubre cuestionarios creados por la comunidad.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- CTA -->
                    <div class="text-center">
                        <a routerLink="/quizzes/public" class="btn btn-primary btn-lg">
                            Explorar cuestionarios
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
    `]
})
export class InformacionComponent {}