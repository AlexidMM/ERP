import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { ErpStoreService } from '../../../shared/erp-store.service';

type RegisterTextField = 'username' | 'email';

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

function adultsOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');

    if (!value) {
      return null;
    }

    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) {
      return { invalidDate: true };
    }

    const currentDate = new Date();
    let age = currentDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = currentDate.getMonth() - birthDate.getMonth();
    const dayDiff = currentDate.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age >= 18 ? null : { underAge: true };
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
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, PasswordModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly erpStore = inject(ErpStoreService);

  readonly registerForm = new FormGroup(
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
        validators: [Validators.required, adultsOnlyValidator()]
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

  readonly feedback = signal<{ severity: 'success' | 'error'; text: string } | null>(null);

  onPreventSpace(event: KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  onTextInputWithoutSpaces(field: RegisterTextField, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedValue = inputElement.value.replace(/\s+/g, '');

    if (inputElement.value !== normalizedValue) {
      inputElement.value = normalizedValue;
    }

    this.registerForm.controls[field].setValue(normalizedValue, { emitEvent: false });
  }

  onPhoneInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedPhone = inputElement.value.replace(/\D/g, '').slice(0, 10);

    if (inputElement.value !== normalizedPhone) {
      inputElement.value = normalizedPhone;
    }

    this.registerForm.controls.phone.setValue(normalizedPhone, { emitEvent: false });
  }

  onSubmit(): void {
    this.normalizeTextFields();
    this.registerForm.markAllAsTouched();

    if (this.registerForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Verifica los datos del formulario antes de registrarte.'
      });
      return;
    }

    const { confirmPassword, ...registerData } = this.registerForm.getRawValue();
    this.erpStore.saveProfile(registerData);

    this.feedback.set({
      severity: 'success',
      text: 'Registro guardado correctamente (solo almacenamiento local).'
    });
  }

  private normalizeTextFields(): void {
    const fieldsWithoutSpaces = ['username', 'email', 'password', 'confirmPassword'] as const;

    for (const field of fieldsWithoutSpaces) {
      const control = this.registerForm.controls[field];
      control.setValue(control.value.replace(/\s+/g, ''), { emitEvent: false });
    }

    const fullNameControl = this.registerForm.controls.fullName;
    fullNameControl.setValue(fullNameControl.value.replace(/\s+/g, ' ').trim(), {
      emitEvent: false
    });

    const addressControl = this.registerForm.controls.address;
    addressControl.setValue(addressControl.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });
  }
}