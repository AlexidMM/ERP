import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';
import { PermissionsService } from '../../services/permissions.service';
import { ErpStoreService, TicketRecord } from '../../shared/erp-store.service';

@Component({
  selector: 'app-tickets',
  imports: [
    ReactiveFormsModule,
    CardModule,
    TagModule,
    TableModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    ButtonModule,
    MessageModule,
    IfHasPermissionDirective
  ],
  templateUrl: './tickets.html',
  styleUrl: './tickets.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketsComponent {
  private readonly erpStore = inject(ErpStoreService);
  private readonly permissionsService = inject(PermissionsService);

  readonly tickets = computed(() => this.erpStore.tickets());
  readonly totalTickets = computed(() => this.tickets().length);
  readonly editingTicketId = signal<string | null>(null);
  readonly isStateOnlyEditing = signal(false);
  readonly feedback = signal<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null);

  readonly canViewTickets = computed(() =>
    this.permissionsService.hasPermission('ticket:view')
  );
  readonly canEditTickets = computed(() => this.permissionsService.hasPermission('ticket:edit'));
  readonly canEditTicketState = computed(() => this.permissionsService.hasPermission('ticket:edit_state'));
  readonly canDeleteTickets = computed(() => this.permissionsService.hasPermission('ticket:delete'));
  readonly canAddTickets = computed(() => this.permissionsService.hasPermission('ticket:add'));
  readonly canManageTickets = computed(() =>
    this.permissionsService.hasAnyPermission(['ticket:add', 'ticket:edit', 'ticket:edit_state'])
  );
  readonly canSubmitCurrentAction = computed(() => {
    if (!this.isEditing()) {
      return this.canAddTickets();
    }

    return this.canEditTickets() || this.canEditTicketState();
  });
  readonly submitButtonLabel = computed(() => {
    if (!this.isEditing()) {
      return 'Agregar ticket';
    }

    if (this.isStateOnlyEditing()) {
      return 'Actualizar estado';
    }

    return 'Guardar cambios';
  });

  private readonly prioritiesCatalog = ['Alta', 'Media', 'Baja'] as const;
  private readonly statusesCatalog = ['Abierto', 'En proceso', 'Cerrado'] as const;

  readonly priorities = [...this.prioritiesCatalog];
  readonly statuses = [...this.statusesCatalog];

  readonly ticketsForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    assignedTo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    priority: new FormControl<(typeof this.prioritiesCatalog)[number]>('Media', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    status: new FormControl<(typeof this.statusesCatalog)[number]>('Abierto', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)]
    })
  });

  readonly isEditing = computed(() => this.editingTicketId() !== null);

  onSubmit(): void {
    const canAdd = this.permissionsService.hasPermission('ticket:add');
    const canEdit = this.permissionsService.hasPermission('ticket:edit');
    const canEditState = this.permissionsService.hasPermission('ticket:edit_state');
    const editing = this.isEditing();

    if ((editing && !canEdit && !canEditState) || (!editing && !canAdd)) {
      this.feedback.set({
        severity: 'error',
        text: editing
          ? 'No cuentas con permiso para editar tickets o cambiar su estado.'
          : 'No cuentas con permiso para agregar tickets.'
      });
      return;
    }

    this.normalizeTextFields();
    this.ticketsForm.markAllAsTouched();

    if (this.ticketsForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Corrige los campos del ticket antes de guardar.'
      });
      return;
    }

    const formValue = this.ticketsForm.getRawValue();
    let payload: Omit<TicketRecord, 'id'> = {
      title: formValue.title,
      assignedTo: formValue.assignedTo,
      priority: formValue.priority,
      status: formValue.status,
      description: formValue.description
    };

    const editId = this.editingTicketId();

    if (editing && !canEdit) {
      const originalTicket = this.tickets().find((item) => item.id === editId);

      if (!originalTicket) {
        this.feedback.set({
          severity: 'error',
          text: 'No se encontró el ticket seleccionado.'
        });
        return;
      }

      payload = {
        title: originalTicket.title,
        assignedTo: originalTicket.assignedTo,
        priority: originalTicket.priority,
        status: formValue.status,
        description: originalTicket.description
      };
    }

    this.erpStore.upsertTicket(payload, editId ?? undefined);

    this.feedback.set({
      severity: 'success',
      text: editId ? 'Ticket actualizado correctamente.' : 'Ticket agregado correctamente.'
    });

    this.resetForm();
  }

  onEdit(ticketId: string): void {
    if (!this.permissionsService.hasPermission('ticket:edit')) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para editar tickets.'
      });
      return;
    }

    const ticket = this.tickets().find((item) => item.id === ticketId);
    if (!ticket) {
      return;
    }

    this.editingTicketId.set(ticketId);
    this.isStateOnlyEditing.set(false);
    this.ticketsForm.setValue({
      title: ticket.title,
      assignedTo: ticket.assignedTo,
      priority: ticket.priority,
      status: ticket.status,
      description: ticket.description
    });

    this.configureControlsByEditMode();

    this.feedback.set({
      severity: 'warn',
      text: 'Editando ticket seleccionado.'
    });
  }

  onEditStatus(ticketId: string): void {
    if (!this.permissionsService.hasPermission('ticket:edit_state')) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para cambiar el estado de tickets.'
      });
      return;
    }

    const ticket = this.tickets().find((item) => item.id === ticketId);
    if (!ticket) {
      return;
    }

    this.editingTicketId.set(ticketId);
    this.isStateOnlyEditing.set(!this.permissionsService.hasPermission('ticket:edit'));
    this.ticketsForm.setValue({
      title: ticket.title,
      assignedTo: ticket.assignedTo,
      priority: ticket.priority,
      status: ticket.status,
      description: ticket.description
    });

    this.configureControlsByEditMode();

    this.feedback.set({
      severity: 'warn',
      text: 'Editando estado del ticket seleccionado.'
    });
  }

  onDelete(ticketId: string): void {
    if (!this.permissionsService.hasPermission('ticket:delete')) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para eliminar tickets.'
      });
      return;
    }

    this.erpStore.deleteTicket(ticketId);

    if (this.editingTicketId() === ticketId) {
      this.resetForm();
    }

    this.feedback.set({
      severity: 'success',
      text: 'Ticket eliminado correctamente.'
    });
  }

  onCancelEdit(): void {
    this.resetForm();
    this.feedback.set({
      severity: 'warn',
      text: 'Edicion cancelada.'
    });
  }

  prioritySeverity(priority: TicketRecord['priority']): 'danger' | 'warn' | 'success' {
    if (priority === 'Alta') {
      return 'danger';
    }

    if (priority === 'Media') {
      return 'warn';
    }

    return 'success';
  }

  statusSeverity(status: TicketRecord['status']): 'secondary' | 'info' | 'success' {
    if (status === 'Abierto') {
      return 'secondary';
    }

    if (status === 'En proceso') {
      return 'info';
    }

    return 'success';
  }

  private normalizeTextFields(): void {
    const fields = ['title', 'assignedTo', 'description'] as const;

    for (const field of fields) {
      const control = this.ticketsForm.controls[field];
      control.setValue(control.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });
    }
  }

  private resetForm(): void {
    this.editingTicketId.set(null);
    this.isStateOnlyEditing.set(false);
    this.ticketsForm.reset({
      title: '',
      assignedTo: '',
      priority: 'Media',
      status: 'Abierto',
      description: ''
    });
    this.configureControlsByEditMode();
    this.ticketsForm.markAsUntouched();
  }

  private configureControlsByEditMode(): void {
    const disableFullEditFields = this.isStateOnlyEditing();
    const fields = ['title', 'assignedTo', 'priority', 'description'] as const;

    for (const field of fields) {
      const control = this.ticketsForm.controls[field];

      if (disableFullEditFields) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }

    this.ticketsForm.controls.status.enable({ emitEvent: false });
  }
}
