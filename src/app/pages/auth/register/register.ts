import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';

  onSubmit() {
    console.log('REGISTER:', {
      name: this.name,
      email: this.email,
      password: this.password
    });
  }
}