import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, PasswordModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly router = inject(Router);

  private readonly hardcodedCredentials = {
    email: 'admin@erp.com',
    password: 'Admin@12345'
  };

  readonly loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  readonly feedback = signal<{ severity: 'success' | 'error'; text: string } | null>(null);

  onSubmit(): void {
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Completa los campos requeridos correctamente.'
      });
      return;
    }

    const { email, password } = this.loginForm.getRawValue();
    const isValidUser =
      email === this.hardcodedCredentials.email && password === this.hardcodedCredentials.password;

    if (!isValidUser) {
      this.feedback.set({
        severity: 'error',
        text: 'Credenciales inválidas. Intenta de nuevo.'
      });
      return;
    }

    this.feedback.set({
      severity: 'success',
      text: 'Inicio de sesión correcto.'
    });

    void this.router.navigateByUrl('/home');
  }
}