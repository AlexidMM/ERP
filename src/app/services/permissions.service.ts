import { Injectable, signal } from '@angular/core';

export type UserRole = 'common' | 'admin';

const COMMON_USER_PERMISSIONS = Object.freeze([
  'group:view',
  'ticket:view',
  'ticket:edit_state',
  'user:view',
  'user:edit'
]);

const ADMIN_USER_PERMISSIONS = Object.freeze([
  'group:view',
  'group:edit',
  'group:add',
  'group:delete',
  'ticket:view',
  'ticket:edit',
  'ticket:add',
  'ticket:delete',
  'ticket:edit_state',
  'user:view',
  'user:edit',
  'user:add',
  'user:delete'
]);

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly _permissions = signal<string[]>([]);

  readonly permissions = this._permissions.asReadonly();

  setPermissions(perms: string[]): void {
    const normalized = this.normalizePermissions(perms);
    this._permissions.set(normalized);
  }

  clearPermissions(): void {
    this._permissions.set([]);
  }

  hasPermission(permission: string): boolean {
    const normalizedPermission = permission.trim().toLowerCase();
    if (!normalizedPermission) {
      return false;
    }

    return this._permissions().includes(normalizedPermission);
  }

  hasAnyPermission(perms: string[]): boolean {
    return perms.some((permission) => this.hasPermission(permission));
  }

  getPermissionsByRole(role: UserRole): string[] {
    if (role === 'admin') {
      return [...ADMIN_USER_PERMISSIONS];
    }

    return [...COMMON_USER_PERMISSIONS];
  }

  getDemoPermissions(): string[] {
    return this.getPermissionsByRole('admin');
  }

  private normalizePermissions(perms: string[]): string[] {
    const normalized = perms
      .map((permission) => permission.trim().toLowerCase())
      .filter((permission) => permission.length > 0);

    return Array.from(new Set(normalized));
  }
}
