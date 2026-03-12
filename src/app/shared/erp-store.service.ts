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

export interface SessionUser {
  key: string;
  email: string;
}

export interface UserRecord {
  key: string;
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
  members: string[];
}

export interface TicketComment {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  assignedTo: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: 'Pendiente' | 'En progreso' | 'Revision' | 'Hecho';
  description: string;
  createdAt: string;
  dueDate: string;
  comments: TicketComment[];
  history: TicketHistoryEntry[];
}

@Injectable({ providedIn: 'root' })
export class ErpStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileStorageKey = 'erp.profile';
  private readonly usersStorageKey = 'erp.users';
  private readonly groupsStorageKey = 'erp.groups';
  private readonly ticketsStorageKey = 'erp.tickets';
  private readonly userPermissionsStorageKey = 'erp.user-permissions';
  private readonly sessionUserStorageKey = 'erp.session-user';
  private readonly selectedGroupStorageKey = 'erp.selected-group';

  private readonly _profile = signal<ProfileRecord | null>(this.readProfileFromStorage());
  private readonly _users = signal<UserRecord[]>(this.readUsersFromStorage());
  private readonly _groups = signal<GroupRecord[]>(this.readGroupsFromStorage());
  private readonly _tickets = signal<TicketRecord[]>(this.readTicketsFromStorage());
  private readonly _userPermissions = signal<Record<string, string[]>>(
    this.readUserPermissionsFromStorage()
  );
  private readonly _sessionUser = signal<SessionUser | null>(this.readSessionUserFromStorage());
  private readonly _selectedGroupId = signal<string | null>(this.readSelectedGroupFromStorage());

  readonly profile = this._profile.asReadonly();
  readonly users = this._users.asReadonly();
  readonly groups = this._groups.asReadonly();
  readonly tickets = this._tickets.asReadonly();
  readonly userPermissions = this._userPermissions.asReadonly();
  readonly sessionUser = this._sessionUser.asReadonly();
  readonly selectedGroupId = this._selectedGroupId.asReadonly();

  setSessionUser(email: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const payload: SessionUser = {
      key: normalizedEmail,
      email: normalizedEmail
    };

    this._sessionUser.set(payload);
    this.writeStorage(this.sessionUserStorageKey, payload);
  }

  clearSessionUser(): void {
    this._sessionUser.set(null);
    this.removeStorage(this.sessionUserStorageKey);
  }

  selectGroup(groupId: string): void {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) {
      return;
    }

    this._selectedGroupId.set(normalizedGroupId);
    this.writeStorage(this.selectedGroupStorageKey, normalizedGroupId);
  }

  clearSelectedGroup(): void {
    this._selectedGroupId.set(null);
    this.removeStorage(this.selectedGroupStorageKey);
  }

  saveProfile(profile: ProfileRecord): void {
    this._profile.set(profile);
    this.writeStorage(this.profileStorageKey, profile);
  }

  upsertUser(user: Omit<UserRecord, 'key'>, previousKey?: string): void {
    const normalizedUser = this.normalizeUserRecord(user);
    if (!normalizedUser) {
      return;
    }

    const current = this._users();
    const normalizedPreviousKey = this.normalizeUserKey(previousKey ?? '');
    const existingIndex = current.findIndex((item) =>
      normalizedPreviousKey ? item.key === normalizedPreviousKey : item.key === normalizedUser.key
    );

    const candidate = {
      ...normalizedUser
    };

    if (existingIndex >= 0) {
      const targetKey = current[existingIndex].key;
      const updated = current.map((item, index) =>
        index === existingIndex
          ? {
              ...candidate,
              key: targetKey
            }
          : item
      );

      this._users.set(updated);
      this.writeStorage(this.usersStorageKey, updated);
      return;
    }

    const next = [...current, candidate];
    this._users.set(next);
    this.writeStorage(this.usersStorageKey, next);
  }

  deleteUser(userKey: string): void {
    const normalizedKey = this.normalizeUserKey(userKey);
    if (!normalizedKey || normalizedKey === 'admin@erp.com') {
      return;
    }

    const next = this._users().filter((item) => item.key !== normalizedKey);
    this._users.set(next);
    this.writeStorage(this.usersStorageKey, next);
  }

  getUserByKey(userKey: string): UserRecord | null {
    const normalizedKey = this.normalizeUserKey(userKey);
    if (!normalizedKey) {
      return null;
    }

    return this._users().find((item) => item.key === normalizedKey) ?? null;
  }

  clearProfile(): void {
    this._profile.set(null);
    this.removeStorage(this.profileStorageKey);
  }

  upsertGroup(group: Omit<GroupRecord, 'id'>, id?: string): void {
    const current = this._groups();

    if (id) {
      const updated = current.map((item) =>
        item.id === id
          ? { ...item, ...group, members: this.normalizeMembers(group.members), id }
          : item
      );
      this._groups.set(updated);
      this.writeStorage(this.groupsStorageKey, updated);
      return;
    }

    const created: GroupRecord = {
      ...group,
      members: this.normalizeMembers(group.members),
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
    const normalizedTicket = this.normalizeTicketPayload(ticket);

    if (id) {
      const updated = current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const statusChanged = item.status !== normalizedTicket.status;
        const history = statusChanged
          ? [
              ...item.history,
              {
                id: this.generateId(),
                action: `Estado cambiado de ${item.status} a ${normalizedTicket.status}`,
                createdAt: new Date().toISOString()
              }
            ]
          : item.history;

        return {
          ...item,
          ...normalizedTicket,
          createdAt: item.createdAt,
          comments: [...item.comments],
          history,
          id
        };
      });
      this._tickets.set(updated);
      this.writeStorage(this.ticketsStorageKey, updated);
      return;
    }

    const created: TicketRecord = {
      ...normalizedTicket,
      comments: [],
      history: [
        {
          id: this.generateId(),
          action: 'Ticket creado',
          createdAt: new Date().toISOString()
        }
      ],
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

  updateTicketStatus(ticketId: string, status: TicketRecord['status'], actor = 'Sistema'): void {
    const current = this._tickets();
    const updated = current.map((ticket) => {
      if (ticket.id !== ticketId || ticket.status === status) {
        return ticket;
      }

      return {
        ...ticket,
        status,
        history: [
          ...ticket.history,
          {
            id: this.generateId(),
            action: `${actor} cambio el estado de ${ticket.status} a ${status}`,
            createdAt: new Date().toISOString()
          }
        ]
      };
    });

    this._tickets.set(updated);
    this.writeStorage(this.ticketsStorageKey, updated);
  }

  addTicketComment(ticketId: string, message: string, author: string): void {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return;
    }

    const current = this._tickets();
    const updated = current.map((ticket) => {
      if (ticket.id !== ticketId) {
        return ticket;
      }

      return {
        ...ticket,
        comments: [
          ...ticket.comments,
          {
            id: this.generateId(),
            author,
            message: normalizedMessage,
            createdAt: new Date().toISOString()
          }
        ],
        history: [
          ...ticket.history,
          {
            id: this.generateId(),
            action: `${author} agrego un comentario`,
            createdAt: new Date().toISOString()
          }
        ]
      };
    });

    this._tickets.set(updated);
    this.writeStorage(this.ticketsStorageKey, updated);
  }

  saveUserPermissions(userKey: string, permissions: string[]): void {
    const normalizedKey = this.normalizeUserKey(userKey);
    if (!normalizedKey) {
      return;
    }

    const normalizedPermissions = this.normalizePermissions(permissions);
    const next = {
      ...this._userPermissions(),
      [normalizedKey]: normalizedPermissions
    };

    this._userPermissions.set(next);
    this.writeStorage(this.userPermissionsStorageKey, next);
  }

  getUserPermissions(userKey: string): string[] {
    const normalizedKey = this.normalizeUserKey(userKey);
    if (!normalizedKey) {
      return [];
    }

    return this._userPermissions()[normalizedKey] ?? [];
  }

  private readProfileFromStorage(): ProfileRecord | null {
    return this.readStorage<ProfileRecord>(this.profileStorageKey);
  }

  private readGroupsFromStorage(): GroupRecord[] {
    const rawGroups = this.readStorage<Array<Partial<GroupRecord>>>(this.groupsStorageKey) ?? [];

    if (rawGroups.length === 0) {
      return [
        {
          id: this.generateId(),
          nivel: 'Equipo',
          autor: 'admin@erp.com',
          nombre: 'Equipo Dev',
          integrantes: 2,
          tickets: 0,
          descripcion: 'Espacio principal para desarrollo.',
          members: ['admin@erp.com', 'user@erp.com']
        },
        {
          id: this.generateId(),
          nivel: 'Operacion',
          autor: 'admin@erp.com',
          nombre: 'Soporte',
          integrantes: 1,
          tickets: 0,
          descripcion: 'Gestion de incidencias y seguimiento.',
          members: ['user@erp.com']
        },
        {
          id: this.generateId(),
          nivel: 'Diseno',
          autor: 'admin@erp.com',
          nombre: 'UX',
          integrantes: 1,
          tickets: 0,
          descripcion: 'Revision de experiencia de usuario.',
          members: ['admin@erp.com']
        }
      ];
    }

    return rawGroups.map((group) => ({
      id: group.id ?? this.generateId(),
      nivel: group.nivel ?? '',
      autor: group.autor ?? '',
      nombre: group.nombre ?? '',
      integrantes: Number(group.integrantes ?? 0),
      tickets: Number(group.tickets ?? 0),
      descripcion: group.descripcion ?? '',
      members: this.normalizeMembers(group.members ?? [])
    }));
  }

  private readUsersFromStorage(): UserRecord[] {
    const rawUsers = this.readStorage<Array<Partial<UserRecord>>>(this.usersStorageKey) ?? [];

    if (rawUsers.length === 0) {
      return [
        {
          key: 'admin@erp.com',
          username: 'admin',
          email: 'admin@erp.com',
          fullName: 'Administrador ERP',
          address: 'Oficina Central',
          phone: '5551234567',
          birthDate: '1990-01-01',
          password: 'Admin@12345'
        },
        {
          key: 'user@erp.com',
          username: 'user',
          email: 'user@erp.com',
          fullName: 'Usuario ERP',
          address: 'Sucursal Norte',
          phone: '5559876543',
          birthDate: '1995-02-10',
          password: 'User@12345'
        }
      ];
    }

    const normalizedUsers = rawUsers
      .map((user) =>
        this.normalizeUserRecord({
          username: String(user.username ?? ''),
          email: String(user.email ?? ''),
          fullName: String(user.fullName ?? ''),
          address: String(user.address ?? ''),
          phone: String(user.phone ?? ''),
          birthDate: String(user.birthDate ?? ''),
          password: String(user.password ?? '')
        })
      )
      .filter((user): user is UserRecord => user !== null);

    if (normalizedUsers.some((user) => user.key === 'admin@erp.com')) {
      return normalizedUsers;
    }

    return [
      {
        key: 'admin@erp.com',
        username: 'admin',
        email: 'admin@erp.com',
        fullName: 'Administrador ERP',
        address: 'Oficina Central',
        phone: '5551234567',
        birthDate: '1990-01-01',
        password: 'Admin@12345'
      },
      ...normalizedUsers
    ];
  }

  private readTicketsFromStorage(): TicketRecord[] {
    const rawTickets = this.readStorage<Array<Partial<TicketRecord>>>(this.ticketsStorageKey) ?? [];

    return rawTickets.map((ticket) => this.normalizeStoredTicket(ticket));
  }

  private readUserPermissionsFromStorage(): Record<string, string[]> {
    const raw = this.readStorage<Record<string, string[]>>(this.userPermissionsStorageKey);
    if (!raw) {
      return {};
    }

    const normalizedEntries = Object.entries(raw).map(([key, value]) => [
      this.normalizeUserKey(key),
      this.normalizePermissions(value ?? [])
    ]);

    return Object.fromEntries(normalizedEntries.filter(([key]) => key.length > 0));
  }

  private readSessionUserFromStorage(): SessionUser | null {
    const raw = this.readStorage<Partial<SessionUser>>(this.sessionUserStorageKey);
    if (!raw) {
      return null;
    }

    const email = String(raw.email ?? '').trim().toLowerCase();
    if (!email) {
      return null;
    }

    return {
      key: email,
      email
    };
  }

  private readSelectedGroupFromStorage(): string | null {
    const raw = this.readStorage<string>(this.selectedGroupStorageKey);
    const value = String(raw ?? '').trim();
    return value.length > 0 ? value : null;
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

  private normalizeStoredTicket(ticket: Partial<TicketRecord>): TicketRecord {
    const normalizedStatus = this.normalizeStatus(ticket.status);
    const createdAt = this.normalizeDate(ticket.createdAt) ?? new Date().toISOString();
    const dueDate = this.normalizeDate(ticket.dueDate) ?? this.defaultDueDate();

    return {
      id: ticket.id ?? this.generateId(),
      groupId: String(ticket.groupId ?? '').trim(),
      createdBy: this.normalizeUserKey(String(ticket.createdBy ?? ticket.assignedTo ?? 'sistema')),
      title: String(ticket.title ?? '').trim(),
      assignedTo: String(ticket.assignedTo ?? '').trim(),
      priority: this.normalizePriority(ticket.priority),
      status: normalizedStatus,
      description: String(ticket.description ?? '').trim(),
      createdAt,
      dueDate,
      comments: (ticket.comments ?? [])
        .map((comment) => ({
          id: comment.id ?? this.generateId(),
          author: String(comment.author ?? 'Sistema').trim() || 'Sistema',
          message: String(comment.message ?? '').trim(),
          createdAt: this.normalizeDate(comment.createdAt) ?? createdAt
        }))
        .filter((comment) => comment.message.length > 0),
      history: this.normalizeHistory(ticket.history, normalizedStatus, createdAt)
    };
  }

  private normalizeHistory(
    history: TicketHistoryEntry[] | undefined,
    status: TicketRecord['status'],
    createdAt: string
  ): TicketHistoryEntry[] {
    const normalized = (history ?? [])
      .map((entry) => ({
        id: entry.id ?? this.generateId(),
        action: String(entry.action ?? '').trim(),
        createdAt: this.normalizeDate(entry.createdAt) ?? createdAt
      }))
      .filter((entry) => entry.action.length > 0);

    if (normalized.length > 0) {
      return normalized;
    }

    return [
      {
        id: this.generateId(),
        action: `Ticket migrado con estado ${status}`,
        createdAt
      }
    ];
  }

  private normalizeTicketPayload(ticket: Omit<TicketRecord, 'id'>): Omit<TicketRecord, 'id'> {
    const nowIso = new Date().toISOString();

    return {
      groupId: ticket.groupId.trim(),
      createdBy: this.normalizeUserKey(ticket.createdBy) || 'sistema',
      title: ticket.title.trim(),
      assignedTo: ticket.assignedTo.trim(),
      priority: this.normalizePriority(ticket.priority),
      status: this.normalizeStatus(ticket.status),
      description: ticket.description.trim(),
      createdAt: this.normalizeDate(ticket.createdAt) ?? nowIso,
      dueDate: this.normalizeDate(ticket.dueDate) ?? this.defaultDueDate(),
      comments: (ticket.comments ?? []).map((comment) => ({
        ...comment,
        id: comment.id ?? this.generateId(),
        author: comment.author.trim() || 'Sistema',
        message: comment.message.trim(),
        createdAt: this.normalizeDate(comment.createdAt) ?? nowIso
      })),
      history: (ticket.history ?? []).map((entry) => ({
        ...entry,
        id: entry.id ?? this.generateId(),
        action: entry.action.trim(),
        createdAt: this.normalizeDate(entry.createdAt) ?? nowIso
      }))
    };
  }

  private normalizeStatus(status: string | undefined): TicketRecord['status'] {
    const normalized = String(status ?? '').trim().toLowerCase();

    if (normalized === 'abierto' || normalized === 'pendiente') {
      return 'Pendiente';
    }

    if (normalized === 'en proceso') {
      return 'En progreso';
    }

    if (normalized === 'revision' || normalized === 'revisión') {
      return 'Revision';
    }

    if (normalized === 'cerrado' || normalized === 'hecho') {
      return 'Hecho';
    }

    return 'Pendiente';
  }

  private normalizePriority(priority: string | undefined): TicketRecord['priority'] {
    const normalized = String(priority ?? '').trim().toLowerCase();

    if (normalized === 'alta' || normalized === '高' || normalized === '紧急' || normalized === '较高') {
      return 'Alta';
    }

    if (normalized === 'baja' || normalized === '低' || normalized === '较低' || normalized === '阻塞') {
      return 'Baja';
    }

    return 'Media';
  }

  private normalizeDate(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  private defaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString();
  }

  private normalizeMembers(members: string[]): string[] {
    const normalized = members
      .map((member) => member.replace(/\s+/g, ' ').trim())
      .filter((member) => member.length > 0);

    return Array.from(new Set(normalized));
  }

  private normalizePermissions(perms: string[]): string[] {
    const normalized = perms
      .map((permission) => permission.trim().toLowerCase())
      .filter((permission) => permission.length > 0);

    return Array.from(new Set(normalized));
  }

  private normalizeUserRecord(user: Omit<UserRecord, 'key'>): UserRecord | null {
    const email = this.normalizeUserKey(user.email);
    if (!email) {
      return null;
    }

    const username = user.username.replace(/\s+/g, '').trim();
    const fullName = user.fullName.replace(/\s+/g, ' ').trim();
    const address = user.address.replace(/\s+/g, ' ').trim();
    const phone = user.phone.replace(/\D/g, '').slice(0, 10);
    const birthDate = user.birthDate.trim();
    const password = user.password.replace(/\s+/g, '').trim();

    if (!username || !fullName || !address || !phone || !birthDate || !password) {
      return null;
    }

    return {
      key: email,
      username,
      email,
      fullName,
      address,
      phone,
      birthDate,
      password
    };
  }

  private normalizeUserKey(userKey: string): string {
    return userKey.trim().toLowerCase();
  }
}
