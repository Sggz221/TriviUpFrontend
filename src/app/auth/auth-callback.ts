import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, AuthResponse } from './auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="min-h-screen flex items-center justify-center px-4 py-12"
      style="background: linear-gradient(to bottom right, var(--base-100), var(--base-200), var(--base-300));">
      <div class="text-center">
        @if (error()) {
          <div class="mb-4 px-6 py-4 rounded-lg text-sm font-medium"
            style="background-color: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);">
            {{ error() }}
          </div>
          <a routerLink="/auth" class="underline" style="color: var(--primary);">Volver al login</a>
        } @else {
          <div class="flex items-center justify-center gap-3" style="color: var(--base-content);">
            <svg class="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
              </path>
            </svg>
            <span class="text-lg font-medium">Iniciando sesión...</span>
          </div>
        }
      </div>
    </section>
  `,
  styleUrls: ['./auth.css']
})
export class AuthCallback implements OnInit {
  error = signal<string | null>(null);

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    console.log('[AuthCallback] ngOnInit called');
    const token = this.route.snapshot.queryParamMap.get('token');
    const userJson = this.route.snapshot.queryParamMap.get('user');
    
    console.log('[AuthCallback] Token:', token ? 'present' : 'null');
    console.log('[AuthCallback] UserJson:', userJson);

    if (token && userJson) {
      try {
        console.log('[AuthCallback] Raw userJson:', userJson);
        const user = JSON.parse(userJson);
        console.log('[AuthCallback] Parsed user:', user);
        const response: AuthResponse = { token, user };
        console.log('[AuthCallback] Saving session with response:', response);
        this.authService.saveSession(response);
        console.log('[AuthCallback] Session saved, navigating to home');
        this.router.navigate(['/']);
      } catch (e) {
        console.error('[AuthCallback] Error parsing user:', e);
        this.error.set('Error al procesar la respuesta de Google. Inténtalo de nuevo.');
      }
    } else {
      console.error('[AuthCallback] Missing token or userJson');
      this.error.set('Token no recibido. El inicio de sesión con Google ha fallado.');
    }
  }
}
