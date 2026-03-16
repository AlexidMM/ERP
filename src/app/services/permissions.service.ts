import { Injectable, signal } from '@angular/core';

const BASIC_PERMISSIONS = Object.freeze([
  'group:view',
  'ticket:view',
  'ticket:edit_state',
  'user:view',
  'user:edit',
]);

const FULL_PERMISSIONS = Object.freeze([
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

  getBasicPermissions(): string[] {
    return [...BASIC_PERMISSIONS];
  }

  getFullPermissions(): string[] {
    return [...FULL_PERMISSIONS];
  }

  getDemoPermissions(): string[] {
    return this.getFullPermissions();
  }

  private normalizePermissions(perms: string[]): string[] {
    const normalized = perms
      .map((permission) => permission.trim().toLowerCase())
      .filter((permission) => permission.length > 0);

    return Array.from(new Set(normalized));
  }
}
