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

export interface TicketRecord {
  id: string;
  title: string;
  assignedTo: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: 'Abierto' | 'En proceso' | 'Cerrado';
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class ErpStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileStorageKey = 'erp.profile';
  private readonly groupsStorageKey = 'erp.groups';
  private readonly ticketsStorageKey = 'erp.tickets';

  private readonly _profile = signal<ProfileRecord | null>(this.readProfileFromStorage());
  private readonly _groups = signal<GroupRecord[]>(this.readGroupsFromStorage());
  private readonly _tickets = signal<TicketRecord[]>(this.readTicketsFromStorage());

  readonly profile = this._profile.asReadonly();
  readonly groups = this._groups.asReadonly();
  readonly tickets = this._tickets.asReadonly();

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

  upsertTicket(ticket: Omit<TicketRecord, 'id'>, id?: string): void {
    const current = this._tickets();

    if (id) {
      const updated = current.map((item) => (item.id === id ? { ...item, ...ticket, id } : item));
      this._tickets.set(updated);
      this.writeStorage(this.ticketsStorageKey, updated);
      return;
    }

    const created: TicketRecord = {
      ...ticket,
      id: this.generateId()
    };

    const next = [...current, created];
    this._tickets.set(next);
    this.writeStorage(this.ticketsStorageKey, next);
  }

  deleteTicket(id: string): void {
    const next = this._tickets().filter((item) => item.id !== id);
    this._tickets.set(next);
    this.writeStorage(this.ticketsStorageKey, next);
  }

  private readProfileFromStorage(): ProfileRecord | null {
    return this.readStorage<ProfileRecord>(this.profileStorageKey);
  }

  private readGroupsFromStorage(): GroupRecord[] {
    return this.readStorage<GroupRecord[]>(this.groupsStorageKey) ?? [];
  }

  private readTicketsFromStorage(): TicketRecord[] {
    return this.readStorage<TicketRecord[]>(this.ticketsStorageKey) ?? [];
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
