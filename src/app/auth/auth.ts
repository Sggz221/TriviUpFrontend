import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css']
})
export class Auth {
  isLoginMode = signal(true);

  loginForm: FormGroup;
  registerForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  switchMode(login: boolean): void {
    this.isLoginMode.set(login);
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      console.log('Login data:', this.loginForm.value);
      // TODO: Conectar con servicio de autenticación
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  onRegister(): void {
    if (this.registerForm.valid) {
      console.log('Register data:', this.registerForm.value);
      // TODO: Conectar con servicio de registro
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
