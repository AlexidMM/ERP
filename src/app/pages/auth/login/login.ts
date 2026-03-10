import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { PermissionsService } from '../../../services/permissions.service';
import { ErpStoreService } from '../../../shared/erp-store.service';

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
  private readonly erpStore = inject(ErpStoreService);

  private readonly hardcodedCredentials: Array<{ email: string; password: string; permissions: string[] }> = [
    {
      email: 'admin@erp.com',
      password: 'Admin@12345',
      permissions: this.permissionsService.getFullPermissions()
    },
    {
      email: 'user@erp.com',
      password: 'User@12345',
      permissions: this.permissionsService.getBasicPermissions()
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
      this.erpStore.clearSessionUser();
      this.erpStore.clearSelectedGroup();
      this.feedback.set({
        severity: 'error',
        text: 'Credenciales inválidas. Intenta de nuevo.'
      });
      return;
    }

    const savedPermissions = this.erpStore.getUserPermissions(currentUser.email);
    const finalPermissions = savedPermissions.length > 0 ? savedPermissions : currentUser.permissions;

    this.feedback.set({
      severity: 'success',
      text: `Inicio de sesión correcto. Se cargaron ${finalPermissions.length} permisos.`
    });

    this.permissionsService.setPermissions(finalPermissions);
    this.erpStore.setSessionUser(currentUser.email);
    this.erpStore.clearSelectedGroup();

    void this.router.navigateByUrl('/home');
  }
}