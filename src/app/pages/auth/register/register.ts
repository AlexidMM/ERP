import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
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

function hasSpecialCharacter(value: string): boolean {
  const specialCharacterRegex = /[!@#$%^&*()_\-+=\[\]{};:'"\\|,.<>/?]/;
  return specialCharacterRegex.test(value);
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
  readonly registerForm = new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email]
      }),
      fullName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      }),
      address: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
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
        validators: [Validators.required, passwordStrengthValidator()]
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      })
    },
    { validators: [matchingPasswordsValidator()] }
  );

  readonly feedback = signal<{ severity: 'success' | 'error'; text: string } | null>(null);

  onPhoneInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedPhone = inputElement.value.replace(/\D/g, '').slice(0, 10);

    if (inputElement.value !== normalizedPhone) {
      inputElement.value = normalizedPhone;
    }

    this.registerForm.controls.phone.setValue(normalizedPhone, { emitEvent: false });
  }

  onSubmit(): void {
    this.registerForm.markAllAsTouched();

    if (this.registerForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Verifica los datos del formulario antes de registrarte.'
      });
      return;
    }

    const { confirmPassword, ...registerData } = this.registerForm.getRawValue();
    this.feedback.set({
      severity: 'success',
      text: 'Registro válido. (Solo validación web, sin backend).'
    });

    console.log('REGISTER SUCCESS:', registerData);
  }
}