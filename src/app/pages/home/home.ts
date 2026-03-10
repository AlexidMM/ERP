import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Router } from '@angular/router';
import { ErpStoreService, TicketRecord } from '../../shared/erp-store.service';
import { PermissionsService } from '../../services/permissions.service';

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
    TextareaModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly erpStore = inject(ErpStoreService);
  private readonly permissionsService = inject(PermissionsService);

  readonly selectedGroupId = this.erpStore.selectedGroupId;
  readonly feedback = signal<{ severity: 'success' | 'warn'; text: string } | null>(null);
  readonly showCreateTicketDialog = signal(false);
  readonly selectedStatusFilter = signal<'Todos' | TicketRecord['status']>('Todos');
  readonly selectedPriorityFilter = signal<'Todas' | TicketRecord['priority']>('Todas');

  private readonly statusesCatalog = ['Pendiente', 'En progreso', 'Revision', 'Hecho'] as const;
  private readonly prioritiesCatalog = ['Alta', 'Media', 'Baja'] as const;

  readonly statusFilterOptions: Array<'Todos' | TicketRecord['status']> = ['Todos', ...this.statusesCatalog];
  readonly priorityFilterOptions: Array<'Todas' | TicketRecord['priority']> = ['Todas', ...this.prioritiesCatalog];

  readonly currentUserKey = computed(() => this.erpStore.sessionUser()?.key ?? '');
  readonly isAdminUser = computed(() => this.currentUserKey() === 'admin@erp.com');

  readonly availableGroups = computed(() => {
    const userKey = this.currentUserKey();
    const groups = this.erpStore.groups();

    if (this.isAdminUser()) {
      return groups;
    }

    if (!userKey) {
      return [];
    }

    return groups.filter((group) =>
      group.members.some((member) => member.trim().toLowerCase() === userKey)
    );
  });

  readonly selectedGroup = computed(() => {
    const selectedId = this.selectedGroupId();
    if (!selectedId) {
      return null;
    }

    return this.availableGroups().find((group) => group.id === selectedId) ?? null;
  });

  readonly canSeeTickets = computed(() => this.permissionsService.hasPermission('ticket:view'));
  readonly canSeeUsers = computed(() => this.permissionsService.hasPermission('user:view'));
  readonly canSeeGroups = computed(() => this.permissionsService.hasPermission('group:view'));
  readonly canAddTickets = computed(() => this.permissionsService.hasPermission('ticket:add'));
  readonly selectedGroupTickets = computed(() => {
    const group = this.selectedGroup();
    if (!group) {
      return [];
    }

    return this.erpStore.tickets().filter((ticket) => ticket.groupId === group.id);
  });
  readonly filteredGroupTickets = computed(() => {
    const statusFilter = this.selectedStatusFilter();
    const priorityFilter = this.selectedPriorityFilter();

    return this.selectedGroupTickets().filter((ticket) => {
      const matchesStatus = statusFilter === 'Todos' ? true : ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'Todas' ? true : ticket.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  });
  readonly selectedGroupStatusSummary = computed(() => {
    const source = this.filteredGroupTickets();
    return [
      { label: 'Pendiente', total: source.filter((t) => t.status === 'Pendiente').length },
      { label: 'En progreso', total: source.filter((t) => t.status === 'En progreso').length },
      { label: 'Revision', total: source.filter((t) => t.status === 'Revision').length },
      { label: 'Hecho', total: source.filter((t) => t.status === 'Hecho').length }
    ];
  });
  readonly kanbanColumns = computed(() => {
    const source = this.filteredGroupTickets();

    return this.statusesCatalog.map((status) => ({
      status,
      tickets: source.filter((ticket) => ticket.status === status)
    }));
  });
  readonly chartSummary = computed(() => {
    const source = this.selectedGroupTickets();
    const total = source.length;
    const done = source.filter((ticket) => ticket.status === 'Hecho').length;
    const scheduled = source.filter((ticket) => ticket.status === 'Pendiente').length;
    const inProgress = source.filter((ticket) => ticket.status === 'En progreso').length;

    const toPercent = (value: number): number => (total === 0 ? 0 : Math.round((value / total) * 100));

    return [
      { label: 'Tickets terminados', total: done, percent: toPercent(done) },
      { label: 'Tickets agendados', total: scheduled, percent: toPercent(scheduled) },
      { label: 'Tickets en progreso', total: inProgress, percent: toPercent(inProgress) }
    ];
  });

  readonly createTicketForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    assignedTo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(80)]
    }),
    priority: new FormControl<'Alta' | 'Media' | 'Baja'>('Media', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    status: new FormControl<'Pendiente' | 'En progreso' | 'Revision' | 'Hecho'>('Pendiente', {
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
    const group = this.availableGroups().find((item) => item.id === groupId);
    this.feedback.set({
      severity: 'success',
      text: group ? `Grupo activo: ${group.nombre}` : 'Grupo activo actualizado.'
    });
  }

  onOpenBoard(): void {
    void this.router.navigateByUrl('/home/tickets');
  }

  onClearGroupSelection(): void {
    this.erpStore.clearSelectedGroup();
    this.feedback.set({
      severity: 'warn',
      text: 'Selecciona un grupo para entrar al dashboard.'
    });
  }

  onStatusFilterChange(value: 'Todos' | TicketRecord['status']): void {
    this.selectedStatusFilter.set(value);
  }

  onPriorityFilterChange(value: 'Todas' | TicketRecord['priority']): void {
    this.selectedPriorityFilter.set(value);
  }

  clearFilters(): void {
    this.selectedStatusFilter.set('Todos');
    this.selectedPriorityFilter.set('Todas');
  }

  openCreateTicketDialog(): void {
    if (!this.selectedGroup()) {
      this.feedback.set({ severity: 'warn', text: 'Selecciona un grupo para crear tickets.' });
      return;
    }

    if (!this.canAddTickets()) {
      this.feedback.set({ severity: 'warn', text: 'No cuentas con permiso para crear tickets.' });
      return;
    }

    this.createTicketForm.reset({
      title: '',
      assignedTo: '',
      priority: 'Media',
      status: 'Pendiente',
      dueDate: this.defaultDueDateInput(),
      description: ''
    });
    this.createTicketForm.markAsUntouched();
    this.showCreateTicketDialog.set(true);
  }

  closeCreateTicketDialog(): void {
    this.showCreateTicketDialog.set(false);
  }

  submitCreateTicket(): void {
    const selectedGroup = this.selectedGroup();
    if (!selectedGroup) {
      return;
    }

    this.createTicketForm.markAllAsTouched();
    if (this.createTicketForm.invalid) {
      return;
    }

    const formValue = this.createTicketForm.getRawValue();
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

    this.feedback.set({
      severity: 'success',
      text: `Ticket creado en ${selectedGroup.nombre}.`
    });
    this.showCreateTicketDialog.set(false);
  }

  private defaultDueDateInput(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
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
}
