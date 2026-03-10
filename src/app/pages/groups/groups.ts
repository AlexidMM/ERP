import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { PermissionsService } from '../../services/permissions.service';
import { ErpStoreService } from '../../shared/erp-store.service';

@Component({
  selector: 'app-groups',
  imports: [
    ReactiveFormsModule,
    CardModule,
    TagModule,
    TableModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './groups.html',
  styleUrl: './groups.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupsComponent {
  private readonly erpStore = inject(ErpStoreService);
  private readonly permissionsService = inject(PermissionsService);

  readonly groups = computed(() => {
    const tickets = this.erpStore.tickets();

    return this.erpStore.groups().map((group) => ({
      ...group,
      integrantes: group.members.length,
      tickets: tickets.filter((ticket) => ticket.groupId === group.id).length
    }));
  });
  readonly totalGroups = computed(() => this.groups().length);
  readonly editingGroupId = signal<string | null>(null);
  readonly groupMembers = signal<string[]>([]);
  readonly newMember = signal('');
  readonly feedback = signal<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null);

  readonly groupsForm = new FormGroup({
    nivel: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)]
    }),
    autor: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    integrantes: new FormControl('0', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+$/)]
    }),
    tickets: new FormControl('0', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+$/)]
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)]
    })
  });

  readonly isEditing = computed(() => this.editingGroupId() !== null);
  readonly canViewGroups = computed(() =>
    this.permissionsService.hasAnyPermission(['group:add', 'group:edit', 'group:delete'])
  );
  readonly canSaveGroups = computed(() =>
    this.permissionsService.hasAnyPermission(['group:add', 'group:edit'])
  );
  readonly canManageGroups = computed(() =>
    this.permissionsService.hasAnyPermission(['group:add', 'group:edit'])
  );
  readonly canEditGroups = computed(() =>
    this.permissionsService.hasPermission('group:edit')
  );
  readonly canDeleteGroups = computed(() =>
    this.permissionsService.hasPermission('group:delete')
  );

  onSubmit(): void {
    const canAdd = this.permissionsService.hasPermission('group:add');
    const canEdit = this.permissionsService.hasPermission('group:edit');
    const editing = this.isEditing();

    if ((editing && !canEdit) || (!editing && !canAdd)) {
      this.feedback.set({
        severity: 'error',
        text: editing
          ? 'No cuentas con permiso para editar grupos.'
          : 'No cuentas con permiso para agregar grupos.'
      });
      return;
    }

    this.normalizeTextFields();
    this.groupsForm.markAllAsTouched();

    if (this.groupsForm.invalid) {
      this.feedback.set({
        severity: 'error',
        text: 'Corrige los campos del grupo antes de guardar.'
      });
      return;
    }

    const formValue = this.groupsForm.getRawValue();
    const editId = this.editingGroupId();
    const ticketCount = editId
      ? this.erpStore.tickets().filter((ticket) => ticket.groupId === editId).length
      : 0;

    const groupPayload = {
      nivel: formValue.nivel,
      autor: formValue.autor,
      nombre: formValue.nombre,
      integrantes: this.groupMembers().length,
      tickets: ticketCount,
      descripcion: formValue.descripcion,
      members: this.groupMembers()
    };

    this.erpStore.upsertGroup(groupPayload, editId ?? undefined);

    this.feedback.set({
      severity: 'success',
      text: editId ? 'Grupo actualizado correctamente.' : 'Grupo agregado correctamente.'
    });

    this.resetForm();
  }

  onEdit(groupId: string): void {
    if (!this.permissionsService.hasPermission('group:edit')) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para editar grupos.'
      });
      return;
    }

    const targetGroup = this.groups().find((item) => item.id === groupId);
    if (!targetGroup) {
      return;
    }

    this.editingGroupId.set(groupId);
    this.groupsForm.setValue({
      nivel: targetGroup.nivel,
      autor: targetGroup.autor,
      nombre: targetGroup.nombre,
      integrantes: String(targetGroup.members.length),
      tickets: String(targetGroup.tickets),
      descripcion: targetGroup.descripcion
    });
    this.groupMembers.set([...targetGroup.members]);

    this.feedback.set({
      severity: 'warn',
      text: 'Editando grupo seleccionado.'
    });
  }

  onDelete(groupId: string): void {
    if (!this.permissionsService.hasPermission('group:delete')) {
      this.feedback.set({
        severity: 'error',
        text: 'No cuentas con permiso para eliminar grupos.'
      });
      return;
    }

    this.erpStore.deleteGroup(groupId);

    if (this.editingGroupId() === groupId) {
      this.resetForm();
    }

    this.feedback.set({
      severity: 'success',
      text: 'Grupo eliminado correctamente.'
    });
  }

  onCancelEdit(): void {
    this.resetForm();
    this.feedback.set({
      severity: 'warn',
      text: 'Edición cancelada.'
    });
  }

  onMemberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newMember.set(input.value);
  }

  addMember(): void {
    const candidate = this.newMember().replace(/\s+/g, ' ').trim();
    if (!candidate) {
      return;
    }

    const normalized = candidate.toLowerCase();
    const exists = this.groupMembers().some((member) => member.toLowerCase() === normalized);
    if (exists) {
      this.feedback.set({
        severity: 'warn',
        text: 'Ese usuario ya forma parte del grupo.'
      });
      return;
    }

    this.groupMembers.set([...this.groupMembers(), candidate]);
    this.groupsForm.controls.integrantes.setValue(String(this.groupMembers().length), {
      emitEvent: false
    });
    this.newMember.set('');
  }

  removeMember(member: string): void {
    this.groupMembers.set(this.groupMembers().filter((currentMember) => currentMember !== member));
    this.groupsForm.controls.integrantes.setValue(String(this.groupMembers().length), {
      emitEvent: false
    });
  }

  onDigitsInput(field: 'integrantes' | 'tickets', event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const normalizedValue = inputElement.value.replace(/\D/g, '');

    if (inputElement.value !== normalizedValue) {
      inputElement.value = normalizedValue;
    }

    this.groupsForm.controls[field].setValue(normalizedValue, { emitEvent: false });
  }

  private normalizeTextFields(): void {
    const textFields = ['nivel', 'autor', 'nombre', 'descripcion'] as const;

    for (const field of textFields) {
      const control = this.groupsForm.controls[field];
      control.setValue(control.value.replace(/\s+/g, ' ').trim(), { emitEvent: false });
    }
  }

  private resetForm(): void {
    this.editingGroupId.set(null);
    this.groupMembers.set([]);
    this.newMember.set('');
    this.groupsForm.reset({
      nivel: '',
      autor: '',
      nombre: '',
      integrantes: '0',
      tickets: '0',
      descripcion: ''
    });
    this.groupsForm.markAsUntouched();
  }
}
