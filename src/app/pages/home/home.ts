import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { ErpStoreService, TicketRecord } from '../../shared/erp-store.service';
import { PermissionsService } from '../../services/permissions.service';

type TicketStatus = TicketRecord['status'];

@Component({
  selector: 'app-home',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    MessageModule,
    TagModule,
    TableModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    SelectButtonModule,
    TooltipModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private readonly erpStore = inject(ErpStoreService);
  private readonly permissionsService = inject(PermissionsService);

  readonly selectedGroupId = this.erpStore.selectedGroupId;
  readonly feedback = signal<{ severity: 'success' | 'warn' | 'error'; text: string } | null>(null);
  readonly showTicketDialog = signal(false);
  readonly editingTicketId = signal<string | null>(null);
  readonly isStateOnlyEditing = signal(false);
  readonly draggedTicketId = signal<string | null>(null);
  readonly viewMode = signal<'kanban' | 'lista'>('kanban');
  readonly selectedStatusFilter = signal<'Todos' | TicketStatus>('Todos');
  readonly selectedPriorityFilter = signal<'Todas' | TicketRecord['priority']>('Todas');

  private readonly statusesCatalog = ['Pendiente', 'En progreso', 'Revision', 'Hecho'] as const;
  private readonly prioritiesCatalog = ['Alta', 'Media', 'Baja'] as const;

  readonly statuses = [...this.statusesCatalog];
  readonly priorities = [...this.prioritiesCatalog];
  readonly statusFilterOptions: Array<'Todos' | TicketStatus> = ['Todos', ...this.statuses];
  readonly priorityFilterOptions: Array<'Todas' | TicketRecord['priority']> = ['Todas', ...this.priorities];

  readonly viewOptions = [
    { label: 'Kanban', value: 'kanban', icon: 'pi pi-table' },
    { label: 'Lista', value: 'lista', icon: 'pi pi-list' }
  ];

  readonly currentUserKey = computed(() => this.erpStore.sessionUser()?.key ?? '');
  readonly isAdminUser = computed(() => this.currentUserKey() === 'admin@erp.com');

  readonly availableGroups = computed(() => {
    const userKey = this.currentUserKey();
    const groups = this.erpStore.groups();
    if (this.isAdminUser()) return groups;
    if (!userKey) return [];
    return groups.filter((g) => g.members.some((m) => m.trim().toLowerCase() === userKey));
  });

  readonly selectedGroup = computed(() => {
    const selectedId = this.selectedGroupId();
    if (!selectedId) return null;
    return this.availableGroups().find((g) => g.id === selectedId) ?? null;
  });

  readonly canAddTickets = computed(() => this.permissionsService.hasPermission('ticket:add'));
  readonly canEditTickets = computed(() => this.permissionsService.hasPermission('ticket:edit'));
  readonly canEditTicketState = computed(() => this.permissionsService.hasPermission('ticket:edit_state'));
  readonly canDeleteTickets = computed(() => this.permissionsService.hasPermission('ticket:delete'));

  readonly selectedGroupTickets = computed(() => {
    const group = this.selectedGroup();
    if (!group) return [];
    return this.erpStore.tickets().filter((t) => t.groupId === group.id);
  });

  readonly filteredGroupTickets = computed(() => {
    const sf = this.selectedStatusFilter();
    const pf = this.selectedPriorityFilter();
    return this.selectedGroupTickets().filter((t) => {
      const ms = sf === 'Todos' || t.status === sf;
      const mp = pf === 'Todas' || t.priority === pf;
      return ms && mp;
    });
  });

  readonly summaryCards = computed(() => {
    const src = this.selectedGroupTickets();
    return [
      { label: 'Total', count: src.length, icon: 'pi pi-ticket', colorClass: 'card-total' },
      {
        label: 'Pendiente',
        count: src.filter((t) => t.status === 'Pendiente').length,
        icon: 'pi pi-clock',
        colorClass: 'card-pending'
      },
      {
        label: 'En progreso',
        count: src.filter((t) => t.status === 'En progreso').length,
        icon: 'pi pi-spinner',
        colorClass: 'card-progress'
      },
      {
        label: 'Revision',
        count: src.filter((t) => t.status === 'Revision').length,
        icon: 'pi pi-search',
        colorClass: 'card-revision'
      },
      {
        label: 'Hecho',
        count: src.filter((t) => t.status === 'Hecho').length,
        icon: 'pi pi-check-circle',
        colorClass: 'card-done'
      }
    ];
  });

  readonly kanbanColumns = computed(() => {
    const src = this.filteredGroupTickets();
    return this.statusesCatalog.map((status) => ({
      status,
      tickets: src.filter((t) => t.status === status)
    }));
  });

  readonly dialogTitle = computed(() => {
    if (!this.editingTicketId()) return 'Nuevo Ticket';
    return this.isStateOnlyEditing() ? 'Cambiar Estado' : 'Editar Ticket';
  });

  readonly submitLabel = computed(() => {
    if (!this.editingTicketId()) return 'Crear ticket';
    return this.isStateOnlyEditing() ? 'Actualizar estado' : 'Guardar cambios';
  });

  readonly ticketForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    assignedTo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)]
    }),
    priority: new FormControl<TicketRecord['priority']>('Media', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    status: new FormControl<TicketStatus>('Pendiente', {
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

  onSelectGroup(groupId: string): void {
    this.erpStore.selectGroup(groupId);
    const g = this.availableGroups().find((x) => x.id === groupId);
    this.feedback.set({
      severity: 'success',
      text: g ? `Grupo activo: ${g.nombre}` : 'Grupo actualizado.'
    });
  }

  onClearGroupSelection(): void {
    this.erpStore.clearSelectedGroup();
    this.feedback.set({ severity: 'warn', text: 'Selecciona un grupo para continuar.' });
  }

  onStatusFilterChange(v: 'Todos' | TicketStatus): void {
    this.selectedStatusFilter.set(v);
  }

  onPriorityFilterChange(v: 'Todas' | TicketRecord['priority']): void {
    this.selectedPriorityFilter.set(v);
  }

  clearFilters(): void {
    this.selectedStatusFilter.set('Todos');
    this.selectedPriorityFilter.set('Todas');
  }

  openCreateTicket(): void {
    if (!this.selectedGroup()) {
      this.feedback.set({ severity: 'warn', text: 'Selecciona un grupo primero.' });
      return;
    }
    if (!this.canAddTickets()) {
      this.feedback.set({ severity: 'warn', text: 'Sin permiso para crear tickets.' });
      return;
    }
    this.editingTicketId.set(null);
    this.isStateOnlyEditing.set(false);
    this.ticketForm.reset({
      title: '',
      assignedTo: '',
      priority: 'Media',
      status: 'Pendiente',
      dueDate: this.defaultDueDateInput(),
      description: ''
    });
    this.ticketForm.enable();
    this.showTicketDialog.set(true);
  }

  openEditTicket(ticketId: string): void {
    const ticket = this.selectedGroupTickets().find((t) => t.id === ticketId);
    if (!ticket) return;

    const canFull = this.canEditFullTicket(ticket);
    const canState = this.canChangeStateTicket(ticket);

    if (!canFull && !canState) {
      this.feedback.set({ severity: 'warn', text: 'Sin permiso para editar este ticket.' });
      return;
    }

    const stateOnly = !canFull && canState;
    this.editingTicketId.set(ticketId);
    this.isStateOnlyEditing.set(stateOnly);
    this.ticketForm.reset({
      title: ticket.title,
      assignedTo: ticket.assignedTo,
      priority: ticket.priority,
      status: ticket.status,
      dueDate: this.formatDateForInput(ticket.dueDate),
      description: ticket.description
    });
    if (stateOnly) {
      this.ticketForm.get('title')?.disable();
      this.ticketForm.get('assignedTo')?.disable();
      this.ticketForm.get('priority')?.disable();
      this.ticketForm.get('dueDate')?.disable();
      this.ticketForm.get('description')?.disable();
    } else {
      this.ticketForm.enable();
    }
    this.showTicketDialog.set(true);
  }

  onDelete(ticketId: string): void {
    if (!this.canDeleteTickets()) {
      this.feedback.set({ severity: 'warn', text: 'Sin permiso para eliminar tickets.' });
      return;
    }
    this.erpStore.deleteTicket(ticketId);
    if (this.editingTicketId() === ticketId) {
      this.editingTicketId.set(null);
      this.showTicketDialog.set(false);
    }
    this.feedback.set({ severity: 'success', text: 'Ticket eliminado.' });
  }

  submitTicket(): void {
    this.ticketForm.markAllAsTouched();
    if (this.ticketForm.invalid) return;

    const formValue = this.ticketForm.getRawValue();
    const editId = this.editingTicketId();
    const selectedGroup = this.selectedGroup();
    if (!selectedGroup) return;

    if (editId) {
      const original = this.selectedGroupTickets().find((t) => t.id === editId);
      if (!original) return;
      const payload: Omit<TicketRecord, 'id'> = this.isStateOnlyEditing()
        ? { ...original, status: formValue.status }
        : {
            ...original,
            title: formValue.title.trim(),
            assignedTo: formValue.assignedTo.trim(),
            priority: formValue.priority,
            status: formValue.status,
            description: formValue.description.trim(),
            dueDate: formValue.dueDate
          };
      this.erpStore.upsertTicket(payload, editId);
      this.feedback.set({ severity: 'success', text: 'Ticket actualizado.' });
    } else {
      if (!this.canAddTickets()) {
        this.feedback.set({ severity: 'warn', text: 'Sin permiso para crear tickets.' });
        return;
      }
      this.erpStore.upsertTicket({
        groupId: selectedGroup.id,
        createdBy: this.currentUserKey() || 'sistema',
        title: formValue.title.trim(),
        assignedTo: formValue.assignedTo.trim(),
        priority: formValue.priority,
        status: formValue.status,
        description: formValue.description.trim(),
        dueDate: formValue.dueDate,
        createdAt: new Date().toISOString(),
        comments: [],
        history: []
      });
      this.feedback.set({ severity: 'success', text: `Ticket creado en ${selectedGroup.nombre}.` });
    }

    this.showTicketDialog.set(false);
    this.editingTicketId.set(null);
  }

  closeTicketDialog(): void {
    this.showTicketDialog.set(false);
    this.editingTicketId.set(null);
  }

  onStartDrag(id: string): void {
    this.draggedTicketId.set(id);
  }

  onEndDrag(): void {
    this.draggedTicketId.set(null);
  }

  onDropStatus(status: TicketStatus): void {
    const id = this.draggedTicketId();
    this.draggedTicketId.set(null);
    if (!id) return;
    const ticket = this.selectedGroupTickets().find((t) => t.id === id);
    if (!ticket || ticket.status === status) return;
    if (!this.canChangeStateTicket(ticket)) {
      this.feedback.set({ severity: 'warn', text: 'Sin permiso para cambiar estado.' });
      return;
    }
    const actor = this.erpStore.sessionUser()?.email ?? 'Usuario';
    this.erpStore.updateTicketStatus(id, status, actor);
    this.feedback.set({ severity: 'success', text: `Estado actualizado a ${status}.` });
  }

  canEditFullTicket(ticket: TicketRecord): boolean {
    return this.canEditTickets() && ticket.createdBy === this.currentUserKey();
  }

  canChangeStateTicket(ticket: TicketRecord): boolean {
    if (!this.canEditTicketState()) return false;
    const key = this.currentUserKey();
    return ticket.createdBy === key || ticket.assignedTo.trim().toLowerCase() === key;
  }

  prioritySeverity(priority: TicketRecord['priority']): 'danger' | 'warn' | 'success' {
    return priority === 'Alta' ? 'danger' : priority === 'Media' ? 'warn' : 'success';
  }

  statusSeverity(status: TicketStatus): 'secondary' | 'info' | 'warn' | 'success' {
    const map: Record<TicketStatus, 'secondary' | 'info' | 'warn' | 'success'> = {
      Pendiente: 'secondary',
      'En progreso': 'info',
      Revision: 'warn',
      Hecho: 'success'
    };
    return map[status];
  }

  formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private formatDateForInput(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return this.defaultDueDateInput();
    return parsed.toISOString().split('T')[0];
  }

  private defaultDueDateInput(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
}
