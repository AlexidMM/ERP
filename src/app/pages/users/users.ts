import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PermissionsService } from '../../services/permissions.service';
import { ErpStoreService } from '../../shared/erp-store.service';

function hasSpecialCharacter(value: string): boolean {
  const specialCharacterRegex = /[!@#$%^&*()_\-+=\[\]{};:'"\\|,.<>/?]/;
  return specialCharacterRegex.test(value);
}

function requiredNoWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    return value.trim().length > 0 ? null : { required: true };
  };
}

function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');

    if (!value) {
      return null;
    }

    if (value.length < 10) {
      return { minLengthPassword: true };
    }

    if (!hasSpecialCharacter(value)) {
      return { missingSpecialCharacter: true };
    }

    return null;
  };
}

function matchingPasswordsValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

@Component({
  selector: 'app-users',
  imports: [
    ReactiveFormsModule,
    CardModule,
    TableModule,
    TagModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent {
  private readonly erpStore = inject(ErpStoreService);
  private readonly permissionsService = inject(PermissionsService);

  readonly profile = computed(() => this.erpStore.profile());
  readonly feedback = signal<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null);
  readonly canViewUsers = computed(() => this.permissionsService.hasPermission('user:view'));
  readonly canEditUsers = computed(() => this.permissionsService.hasPermission('user:edit'));
  readonly canManageUsers = computed(() =>
    this.permissionsService.hasAnyPermission(['user:edit', 'user:delete'])
  );
  readonly canSaveUsers = computed(() => this.canEditUsers() && this.profile() !== null);
  readonly canDeleteUsers = computed(() => this.permissionsService.hasPermission('user:delete'));

  readonly assignedTickets = computed(() => {
    const currentProfile = this.profile();
    if (!currentProfile) {
      return [];
    }

    const tokens = [currentProfile.username, currentProfile.email, currentProfile.fullName]
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);

    return this.erpStore.tickets().filter((ticket) => {
      const assigned = ticket.assignedTo.trim().toLowerCase();
      return tokens.some((token) => assigned.includes(token));
    });
  });

  readonly openTickets = computed(
    () => this.assignedTickets().filter((ticket) => ticket.status !== 'Hecho').length
  );

  readonly completedTickets = computed(
    () => this.assignedTickets().filter((ticket) => ticket.status === 'Hecho').length
  );

  readonly usersForm = new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, requiredNoWhitespaceValidator()]
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, requiredNoWhitespaceValidator(), Validators.email]
      }),
      fullName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, requiredNoWhitespaceValidator()]
      }),
      address: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, requiredNoWhitespaceValidator()]
      }),
      phone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{10}$/)]
      }),
      birthDate: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, requiredNoWhitespaceValidator(), passwordStrengthValidator()]
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, requiredNoWhitespaceValidator()]
      })
    },
    { validators: [matchingPasswordsValidator()] }
  );

  constructor() {
    effect(() => {
      const currentProfile = this.profile();

      if (!currentProfile) {
        this.usersForm.reset({
          username: '',
          email: '',
          fullName: '',
          address: '',
          phone: '',
          birthDate: '',
          password: '',
          confirmPassword: ''
        });
        this.usersForm.markAsUntouched();
        return;
      }

      this.usersForm.setValue({
        username: currentProfile.username,
        email: currentProfile.email,
        fullName: currentProfile.fullName,
        address: currentProfile.address,
        phone: currentProfile.phone,
        birthDate: currentProfile.birthDate,
        password: currentProfile.password,
        confirmPassword: currentProfile.password
      });
      this.usersForm.markAsUntouched();
    });
  }

  onTextInputWithoutSpaces(field: 'username' | 'email', event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedValue = inputElement.value.replace(/\s+/g, '');

    if (inputElement.value !== normalizedValue) {
      inputElement.value = normalizedValue;
    }

    this.usersForm.controls[field].setValue(normalizedValue, { emitEvent: false });
  }

  onPhoneInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedPhone = inputElement.value.replace(/\D/g, '').slice(0, 10);

    if (inputElement.value !== normalizedPhone) {
      inputElement.value = normalizedPhone;
    }

    this.usersForm.controls.phone.setValue(normalizedPhone, { emitEvent: false });
  }

  onSubmit(): void {
    const hasProfile = this.profile() !== null;

    if (!hasProfile) {
      this.feedback.set({
        severity: 'warn',
        text: 'No hay perfil cargado para editar.'
      });
      return;
    }

    if (!this.canEditUsers()) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para editar usuarios.'
      });
      return;
    }

    this.normalizeTextFields();
    this.usersForm.markAllAsTouched();

    if (this.usersForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Corrige los campos del perfil antes de guardar.'
      });
      return;
    }

    const { confirmPassword, ...profileData } = this.usersForm.getRawValue();
    this.erpStore.saveProfile(profileData);

    this.feedback.set({
      severity: 'success',
      text: 'Perfil actualizado correctamente (almacenamiento local).'
    });
  }

  onDeleteProfile(): void {
    if (!this.permissionsService.hasPermission('user:delete')) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para eliminar usuarios.'
      });
      return;
    }

    this.erpStore.clearProfile();
    this.feedback.set({
      severity: 'warn',
      text: 'Perfil eliminado correctamente.'
    });
  }

  formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return parsed.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  ticketStatusSeverity(
    status: 'Pendiente' | 'En progreso' | 'Revision' | 'Hecho'
  ): 'secondary' | 'info' | 'warn' | 'success' {
    if (status === 'Pendiente') {
      return 'secondary';
    }

    if (status === 'En progreso') {
      return 'info';
    }

    if (status === 'Revision') {
      return 'warn';
    }

    return 'success';
  }

  private normalizeTextFields(): void {
    const fieldsWithoutSpaces = ['username', 'email', 'password', 'confirmPassword'] as const;

    for (const field of fieldsWithoutSpaces) {
      const control = this.usersForm.controls[field];
      control.setValue(control.value.replace(/\s+/g, ''), { emitEvent: false });
    }

    const fullNameControl = this.usersForm.controls.fullName;
    fullNameControl.setValue(fullNameControl.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });

    const addressControl = this.usersForm.controls.address;
    addressControl.setValue(addressControl.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });
  }
}
