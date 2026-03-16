import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { TimelineModule } from 'primeng/timeline';
import { TicketHistoryEntry, TicketRecord } from '../../shared/erp-store.service';

@Component({
  selector: 'app-ticket-detail-modal',
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, TextareaModule, ButtonModule, MessageModule, TimelineModule],
  templateUrl: './ticket-detail-modal.html',
  styleUrl: './ticket-detail-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketDetailModalComponent {
  @Input({ required: true }) visible = false;
  @Input({ required: true }) ticket: TicketRecord | null = null;
  @Input({ required: true }) commentForm!: FormGroup;
  @Input({ required: true }) canComment = false;

  @Input() header = 'Detalle del Ticket';
  @Input() dialogWidth = 'min(780px, 96vw)';

  @Output() readonly visibleChange = new EventEmitter<boolean>();
  @Output() readonly addComment = new EventEmitter<void>();

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onAddComment(): void {
    this.addComment.emit();
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

  historyLabel(entry: TicketHistoryEntry): string {
    return `${entry.action} - ${this.formatDate(entry.createdAt)}`;
  }
}
