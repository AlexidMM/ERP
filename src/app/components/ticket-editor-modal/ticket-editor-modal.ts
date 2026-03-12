import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'app-ticket-editor-modal',
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, InputTextModule, SelectModule, TextareaModule, ButtonModule],
  templateUrl: './ticket-editor-modal.html',
  styleUrl: './ticket-editor-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketEditorModalComponent {
  @Input({ required: true }) visible = false;
  @Input({ required: true }) header = '';
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) priorities: string[] = [];
  @Input({ required: true }) statuses: string[] = [];
  @Input({ required: true }) submitLabel = 'Guardar';

  @Input() closeLabel = 'Cerrar';
  @Input() dialogWidth = 'min(720px, 95vw)';
  @Input() idPrefix = 'ticket-editor';

  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly submitForm = new EventEmitter<void>();
  @Output() readonly close = new EventEmitter<void>();

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onSubmit(): void {
    this.submitForm.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
