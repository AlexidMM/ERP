import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TimelineModule } from 'primeng/timeline';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';
import { PermissionsService } from '../../services/permissions.service';
import { ErpStoreService, TicketHistoryEntry, TicketRecord } from '../../shared/erp-store.service';

type TicketStatus = TicketRecord['status'];

@Component({
  selector: 'app-tickets',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CardModule,
    DialogModule,
    TagModule,
    TableModule,
    TimelineModule,
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

  readonly selectedGroupId = computed(() => this.erpStore.selectedGroupId() ?? '');
  readonly tickets = computed(() => {
    const groupId = this.selectedGroupId();
    if (!groupId) {
      return [];
    }

    return this.erpStore.tickets().filter((ticket) => ticket.groupId === groupId);
  });
  readonly totalTickets = computed(() => this.tickets().length);
  readonly editingTicketId = signal<string | null>(null);
  readonly selectedTicketId = signal<string | null>(null);
  readonly draggedTicketId = signal<string | null>(null);
  readonly isStateOnlyEditing = signal(false);
  readonly showDetailDialog = signal(false);
  readonly showQuickCreateDialog = signal(false);
  readonly quickSearch = signal('');
  readonly quickMode = signal<'all' | 'mine' | 'unassigned' | 'high'>('all');
  readonly selectedStatusFilter = signal<'Todos' | TicketStatus>('Todos');
  readonly selectedPriorityFilter = signal<'Todas' | TicketRecord['priority']>('Todas');
  readonly feedback = signal<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null);

  readonly canViewTickets = computed(() => this.permissionsService.hasPermission('ticket:view'));
  readonly hasSelectedGroup = computed(() => this.erpStore.selectedGroupId() !== null);
  readonly currentUserKey = computed(() => this.erpStore.sessionUser()?.key ?? '');
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
  readonly quickDialogTitle = computed(() => {
    if (!this.isEditing()) {
      return 'Crear Ticket Rapido';
    }

    return this.isStateOnlyEditing() ? 'Cambiar Estado del Ticket' : 'Editar Ticket';
  });

  private readonly prioritiesCatalog = ['Alta', 'Media', 'Baja'] as const;
  private readonly statusesCatalog = ['Pendiente', 'En progreso', 'Revision', 'Hecho'] as const;

  readonly priorities = [...this.prioritiesCatalog];
  readonly statuses = [...this.statusesCatalog];
  readonly statusFilterOptions: Array<'Todos' | TicketStatus> = ['Todos', ...this.statuses];
  readonly priorityFilterOptions: Array<'Todas' | TicketRecord['priority']> = ['Todas', ...this.priorities];

  readonly selectedTicket = computed(() => {
    const currentTicketId = this.selectedTicketId();
    if (!currentTicketId) {
      return null;
    }

    return this.tickets().find((ticket) => ticket.id === currentTicketId) ?? null;
  });

  readonly filteredTickets = computed(() => {
    const search = this.quickSearch().trim().toLowerCase();
    const selectedStatus = this.selectedStatusFilter();
    const selectedPriority = this.selectedPriorityFilter();
    const quickMode = this.quickMode();
    const userKey = this.currentUserKey();

    return this.tickets().filter((ticket) => {
      const matchesStatus = selectedStatus === 'Todos' ? true : ticket.status === selectedStatus;
      const matchesPriority = selectedPriority === 'Todas' ? true : ticket.priority === selectedPriority;
      const matchesSearch =
        search.length === 0
          ? true
          : `${ticket.title} ${ticket.description} ${ticket.assignedTo}`.toLowerCase().includes(search);

      const assignedTo = ticket.assignedTo.trim().toLowerCase();
      const matchesQuickMode =
        quickMode === 'all'
          ? true
          : quickMode === 'mine'
            ? userKey.length > 0 && assignedTo.includes(userKey)
            : quickMode === 'unassigned'
              ? assignedTo.length === 0
              : ticket.priority === 'Alta';

      return matchesStatus && matchesPriority && matchesSearch && matchesQuickMode;
    });
  });

  readonly groupedByStatus = computed(() => {
    const source = this.filteredTickets();

    return this.statuses.map((status) => ({
      status,
      tickets: source.filter((ticket) => ticket.status === status)
    }));
  });

  readonly ticketsForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    assignedTo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)]
    }),
    priority: new FormControl<(typeof this.prioritiesCatalog)[number]>('Media', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    status: new FormControl<(typeof this.statusesCatalog)[number]>('Pendiente', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    dueDate: new FormControl(this.defaultDueDateInput(), {
      nonNullable: true,
      validators: [Validators.required]
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)]
    })
  });

  readonly commentForm = new FormGroup({
    message: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(250)]
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
      groupId: this.selectedGroupId(),
      title: formValue.title,
      assignedTo: formValue.assignedTo,
      priority: formValue.priority,
      status: formValue.status,
      description: formValue.description,
      dueDate: formValue.dueDate,
      createdAt: new Date().toISOString(),
      comments: [],
      history: []
    };

    const editId = this.editingTicketId();
    const originalTicket = editId ? this.tickets().find((item) => item.id === editId) : null;

    if (editing && !canEdit) {
      if (!originalTicket) {
        this.feedback.set({
          severity: 'error',
          text: 'No se encontró el ticket seleccionado.'
        });
        return;
      }

      payload = {
        groupId: originalTicket.groupId,
        title: originalTicket.title,
        assignedTo: originalTicket.assignedTo,
        priority: originalTicket.priority,
        status: formValue.status,
        description: originalTicket.description,
        dueDate: originalTicket.dueDate,
        createdAt: originalTicket.createdAt,
        comments: originalTicket.comments,
        history: originalTicket.history
      };
    } else if (editing && canEdit) {
      payload.groupId = originalTicket?.groupId ?? this.selectedGroupId();
      payload.createdAt = originalTicket?.createdAt ?? new Date().toISOString();
      payload.comments = originalTicket?.comments ?? [];
      payload.history = originalTicket?.history ?? [];
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
      dueDate: this.formatDateForInput(ticket.dueDate),
      description: ticket.description
    });

    this.configureControlsByEditMode();

    this.feedback.set({
      severity: 'warn',
      text: 'Editando ticket seleccionado.'
    });

    this.showQuickCreateDialog.set(true);
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
      dueDate: this.formatDateForInput(ticket.dueDate),
      description: ticket.description
    });

    this.configureControlsByEditMode();

    this.feedback.set({
      severity: 'warn',
      text: 'Editando estado del ticket seleccionado.'
    });

    this.showQuickCreateDialog.set(true);
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

    if (this.selectedTicketId() === ticketId) {
      this.closeDetailDialog();
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

  openQuickCreate(): void {
    if (!this.selectedGroupId()) {
      this.feedback.set({
        severity: 'warn',
        text: 'Selecciona primero un grupo desde Home para crear o editar tickets.'
      });
      return;
    }

    if (!this.hasSelectedGroup()) {
      this.feedback.set({
        severity: 'warn',
        text: 'Selecciona primero un grupo desde Home para crear tickets.'
      });
      return;
    }

    if (!this.canAddTickets()) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para crear tickets.'
      });
      return;
    }

    this.resetForm();
    this.showQuickCreateDialog.set(true);
  }

  closeQuickCreate(): void {
    this.showQuickCreateDialog.set(false);
    this.resetForm();
  }

  onSubmitQuickCreate(): void {
    this.onSubmit();
    if (this.feedback()?.severity === 'success') {
      this.showQuickCreateDialog.set(false);
    }
  }

  onStartDrag(ticketId: string): void {
    this.draggedTicketId.set(ticketId);
  }

  onEndDrag(): void {
    this.draggedTicketId.set(null);
  }

  onDropStatus(targetStatus: TicketStatus): void {
    const ticketId = this.draggedTicketId();
    this.draggedTicketId.set(null);

    if (!ticketId || !this.canEditTicketState()) {
      return;
    }

    const actor = this.erpStore.sessionUser()?.email ?? 'Usuario';
    this.erpStore.updateTicketStatus(ticketId, targetStatus, actor);
    this.feedback.set({
      severity: 'success',
      text: `Estado actualizado a ${targetStatus}.`
    });
  }

  openDetailDialog(ticketId: string): void {
    this.selectedTicketId.set(ticketId);
    this.showDetailDialog.set(true);
    this.commentForm.reset({ message: '' });
    this.commentForm.markAsUntouched();
  }

  closeDetailDialog(): void {
    this.showDetailDialog.set(false);
    this.selectedTicketId.set(null);
  }

  addComment(): void {
    const ticket = this.selectedTicket();
    if (!ticket) {
      return;
    }

    this.commentForm.markAllAsTouched();
    if (this.commentForm.invalid) {
      return;
    }

    this.erpStore.addTicketComment(ticket.id, this.commentForm.controls.message.value, 'Usuario ERP');
    this.commentForm.reset({ message: '' });
    this.commentForm.markAsUntouched();
  }

  onStatusFilterChange(value: 'Todos' | TicketStatus): void {
    this.selectedStatusFilter.set(value);
  }

  onPriorityFilterChange(value: 'Todas' | TicketRecord['priority']): void {
    this.selectedPriorityFilter.set(value);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.quickSearch.set(target.value);
  }

  onQuickModeChange(mode: 'all' | 'mine' | 'unassigned' | 'high'): void {
    this.quickMode.set(mode);
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

  prioritySeverity(priority: TicketRecord['priority']): 'danger' | 'warn' | 'success' {
    if (priority === 'Alta') {
      return 'danger';
    }

    if (priority === 'Media') {
      return 'warn';
    }

    return 'success';
  }

  statusSeverity(status: TicketRecord['status']): 'secondary' | 'info' | 'warn' | 'success' {
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
      status: 'Pendiente',
      dueDate: this.defaultDueDateInput(),
      description: ''
    });
    this.configureControlsByEditMode();
    this.ticketsForm.markAsUntouched();
  }

  private configureControlsByEditMode(): void {
    const disableFullEditFields = this.isStateOnlyEditing();
    const fields = ['title', 'assignedTo', 'priority', 'description', 'dueDate'] as const;

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

  private defaultDueDateInput(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }

  private formatDateForInput(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return this.defaultDueDateInput();
    }

    return parsed.toISOString().split('T')[0];
  }
}
