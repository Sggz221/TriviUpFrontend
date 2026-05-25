import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css']
})
export class Auth implements OnInit {
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  activeTab = signal<'login' | 'register'>('login');
  showLoginPassword = signal(false);
  showRegisterPassword = signal(false);

  loginForm: FormGroup;
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/']);
    }
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set(null);

      const { username, password } = this.loginForm.value;
      this.authService.signIn({ username, password }).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.successMessage.set(`¡Bienvenido, ${response.user.username}!`);
          setTimeout(() => this.router.navigate(['/']), 1000);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            err.error?.message || 'Usuario o contraseña incorrectos. Inténtalo de nuevo.'
          );
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  signInWithGoogle(): void {
    window.location.href = 'https://triviup-backend-production.up.railway.app/auth/google';
  }

  switchTab(tab: 'login' | 'register'): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  toggleLoginPassword(): void {
    this.showLoginPassword.set(!this.showLoginPassword());
  }

  toggleRegisterPassword(): void {
    this.showRegisterPassword.set(!this.showRegisterPassword());
  }

  onRegister(): void {
    if (this.registerForm.valid) {
      const { password, confirmPassword } = this.registerForm.value;
      if (password !== confirmPassword) {
        this.errorMessage.set('Las contraseñas no coinciden');
        return;
      }

      this.isLoading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);

      const { username, email } = this.registerForm.value;
      this.authService.signUp({ username, email, password }).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.successMessage.set(`¡Cuenta creada! Bienvenido, ${response.user.username}!`);
          setTimeout(() => this.router.navigate(['/']), 1500);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            err.error?.message || 'No se pudo crear la cuenta. Inténtalo de nuevo.'
          );
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
