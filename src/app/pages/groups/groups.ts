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

  readonly groups = computed(() => this.erpStore.groups());
  readonly totalGroups = computed(() => this.groups().length);
  readonly editingGroupId = signal<string | null>(null);
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
    integrantes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+$/)]
    }),
    tickets: new FormControl('', {
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
    this.permissionsService.hasPermission('group:view')
  );
  readonly canSaveGroups = computed(() =>
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
    const groupPayload = {
      nivel: formValue.nivel,
      autor: formValue.autor,
      nombre: formValue.nombre,
      integrantes: Number(formValue.integrantes),
      tickets: Number(formValue.tickets),
      descripcion: formValue.descripcion
    };

    const editId = this.editingGroupId();
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
      integrantes: String(targetGroup.integrantes),
      tickets: String(targetGroup.tickets),
      descripcion: targetGroup.descripcion
    });

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
    this.groupsForm.reset({
      nivel: '',
      autor: '',
      nombre: '',
      integrantes: '',
      tickets: '',
      descripcion: ''
    });
    this.groupsForm.markAsUntouched();
  }
}
