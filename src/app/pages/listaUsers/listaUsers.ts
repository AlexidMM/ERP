import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { PasswordModule } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PermissionsService } from '../../services/permissions.service';
import { ErpStoreService, UserRecord } from '../../shared/erp-store.service';

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

@Component({
  selector: 'app-lista-users',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    TableModule,
    TagModule,
    InputTextModule,
    PasswordModule,
    MultiSelectModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './listaUsers.html',
  styleUrl: './listaUsers.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListaUsersComponent {
  private readonly erpStore = inject(ErpStoreService);
  private readonly permissionsService = inject(PermissionsService);

  readonly users = computed(() => this.erpStore.users());
  readonly selectedUserKey = signal<string | null>(null);
  readonly editablePermissions = signal<string[]>([]);
  readonly feedback = signal<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null);

  readonly canCreateUsers = computed(() => this.permissionsService.hasPermission('user:add'));
  readonly canEditUsers = computed(() => this.permissionsService.hasPermission('user:edit'));
  readonly canDeleteUsers = computed(() => this.permissionsService.hasPermission('user:delete'));
  readonly canAccessManagement = computed(() =>
    this.permissionsService.hasAnyPermission(['user:add', 'user:edit', 'user:delete'])
  );

  readonly isEditing = computed(() => this.selectedUserKey() !== null);
  readonly selectedUser = computed(() => {
    const selectedKey = this.selectedUserKey();
    if (!selectedKey) {
      return null;
    }

    return this.erpStore.getUserByKey(selectedKey);
  });

  readonly availablePermissions = this.permissionsService.getFullPermissions();

  readonly userForm = new FormGroup({
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
    })
  });

  constructor() {
    effect(() => {
      const selected = this.selectedUser();

      if (!selected) {
        this.userForm.reset({
          username: '',
          email: '',
          fullName: '',
          address: '',
          phone: '',
          birthDate: '',
          password: ''
        });
        this.editablePermissions.set([]);
        this.userForm.markAsUntouched();
        return;
      }

      this.userForm.setValue({
        username: selected.username,
        email: selected.email,
        fullName: selected.fullName,
        address: selected.address,
        phone: selected.phone,
        birthDate: selected.birthDate,
        password: selected.password
      });
      this.editablePermissions.set(this.getPermissionsForUser(selected.key));
      this.userForm.markAsUntouched();
    });
  }

  onCreateNew(): void {
    this.selectedUserKey.set(null);
    this.feedback.set(null);
  }

  onSelectUser(user: UserRecord): void {
    this.selectedUserKey.set(user.key);
    this.feedback.set(null);
  }

  onTextInputWithoutSpaces(field: 'username' | 'email', event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedValue = inputElement.value.replace(/\s+/g, '');

    if (inputElement.value !== normalizedValue) {
      inputElement.value = normalizedValue;
    }

    this.userForm.controls[field].setValue(normalizedValue, { emitEvent: false });
  }

  onPhoneInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedPhone = inputElement.value.replace(/\D/g, '').slice(0, 10);

    if (inputElement.value !== normalizedPhone) {
      inputElement.value = normalizedPhone;
    }

    this.userForm.controls.phone.setValue(normalizedPhone, { emitEvent: false });
  }

  onPermissionSelectionChange(permissions: string[]): void {
    this.editablePermissions.set(permissions);
  }

  onSaveUser(): void {
    const editing = this.isEditing();

    if ((editing && !this.canEditUsers()) || (!editing && !this.canCreateUsers())) {
      this.feedback.set({
        severity: 'error',
        text: editing
          ? 'No cuentas con permiso para editar usuarios.'
          : 'No cuentas con permiso para crear usuarios.'
      });
      return;
    }

    this.normalizeTextFields();
    this.userForm.markAllAsTouched();

    if (this.userForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Corrige los campos del formulario antes de guardar.'
      });
      return;
    }

    const payload = this.userForm.getRawValue();
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existing = this.erpStore.getUserByKey(normalizedEmail);

    if (!editing && existing) {
      this.feedback.set({
        severity: 'error',
        text: 'Ya existe un usuario con ese email.'
      });
      return;
    }

    this.erpStore.upsertUser(payload, this.selectedUserKey() ?? undefined);
    this.erpStore.saveUserPermissions(normalizedEmail, this.editablePermissions());
    this.selectedUserKey.set(normalizedEmail);

    this.feedback.set({
      severity: 'success',
      text: editing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.'
    });
  }

  onDeleteUser(): void {
    if (!this.canDeleteUsers()) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para eliminar usuarios.'
      });
      return;
    }

    const selectedKey = this.selectedUserKey();
    if (!selectedKey) {
      this.feedback.set({
        severity: 'warn',
        text: 'Selecciona un usuario para eliminar.'
      });
      return;
    }

    if (selectedKey === 'admin@erp.com') {
      this.feedback.set({
        severity: 'warn',
        text: 'El usuario admin no se puede eliminar.'
      });
      return;
    }

    this.erpStore.deleteUser(selectedKey);
    this.selectedUserKey.set(null);

    this.feedback.set({
      severity: 'success',
      text: 'Usuario eliminado correctamente.'
    });
  }

  private getPermissionsForUser(userKey: string): string[] {
    const stored = this.erpStore.getUserPermissions(userKey);
    if (stored.length > 0) {
      return stored;
    }

    const normalized = userKey.trim().toLowerCase();
    if (normalized === 'admin@erp.com') {
      return this.permissionsService.getFullPermissions();
    }

    if (normalized === 'user@erp.com') {
      return this.permissionsService.getBasicPermissions();
    }

    return [];
  }

  private normalizeTextFields(): void {
    const fieldsWithoutSpaces = ['username', 'email', 'password'] as const;

    for (const field of fieldsWithoutSpaces) {
      const control = this.userForm.controls[field];
      control.setValue(control.value.replace(/\s+/g, ''), { emitEvent: false });
    }

    const fullNameControl = this.userForm.controls.fullName;
    fullNameControl.setValue(fullNameControl.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });

    const addressControl = this.userForm.controls.address;
    addressControl.setValue(addressControl.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });
  }
}
