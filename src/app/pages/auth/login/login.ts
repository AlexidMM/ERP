import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { PermissionsService, UserRole } from '../../../services/permissions.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, PasswordModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly permissionsService = inject(PermissionsService);

  private readonly hardcodedCredentials: Array<{ email: string; password: string; role: UserRole }> = [
    {
      email: 'admin@erp.com',
      password: 'Admin@12345',
      role: 'admin'
    },
    {
      email: 'user@erp.com',
      password: 'User@12345',
      role: 'common'
    }
  ];

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
    const currentUser = this.hardcodedCredentials.find(
      (credential) => credential.email === email && credential.password === password
    );

    if (!currentUser) {
      this.permissionsService.clearPermissions();
      this.feedback.set({
        severity: 'error',
        text: 'Credenciales inválidas. Intenta de nuevo.'
      });
      return;
    }

    this.feedback.set({
      severity: 'success',
      text: `Inicio de sesión correcto. Perfil: ${currentUser.role}.`
    });

    this.permissionsService.setPermissions(this.permissionsService.getPermissionsByRole(currentUser.role));

    void this.router.navigateByUrl('/home');
  }
}