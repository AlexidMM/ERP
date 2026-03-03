import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export interface ProfileRecord {
  username: string;
  email: string;
  fullName: string;
  address: string;
  phone: string;
  birthDate: string;
  password: string;
}

export interface GroupRecord {
  id: string;
  nivel: string;
  autor: string;
  nombre: string;
  integrantes: number;
  tickets: number;
  descripcion: string;
}

@Injectable({ providedIn: 'root' })
export class ErpStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileStorageKey = 'erp.profile';
  private readonly groupsStorageKey = 'erp.groups';

  private readonly _profile = signal<ProfileRecord | null>(this.readProfileFromStorage());
  private readonly _groups = signal<GroupRecord[]>(this.readGroupsFromStorage());

  readonly profile = this._profile.asReadonly();
  readonly groups = this._groups.asReadonly();

  saveProfile(profile: ProfileRecord): void {
    this._profile.set(profile);
    this.writeStorage(this.profileStorageKey, profile);
  }

  clearProfile(): void {
    this._profile.set(null);
    this.removeStorage(this.profileStorageKey);
  }

  upsertGroup(group: Omit<GroupRecord, 'id'>, id?: string): void {
    const current = this._groups();

    if (id) {
      const updated = current.map((item) => (item.id === id ? { ...item, ...group, id } : item));
      this._groups.set(updated);
      this.writeStorage(this.groupsStorageKey, updated);
      return;
    }

    const created: GroupRecord = {
      ...group,
      id: this.generateId()
    };

    const next = [...current, created];
    this._groups.set(next);
    this.writeStorage(this.groupsStorageKey, next);
  }

  deleteGroup(id: string): void {
    const next = this._groups().filter((item) => item.id !== id);
    this._groups.set(next);
    this.writeStorage(this.groupsStorageKey, next);
  }

  private readProfileFromStorage(): ProfileRecord | null {
    return this.readStorage<ProfileRecord>(this.profileStorageKey);
  }

  private readGroupsFromStorage(): GroupRecord[] {
    return this.readStorage<GroupRecord[]>(this.groupsStorageKey) ?? [];
  }

  private readStorage<T>(key: string): T | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: unknown): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }

  private removeStorage(key: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(key);
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 11);
  }
}
