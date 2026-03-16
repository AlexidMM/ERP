import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

export const ticketViewGuard: CanActivateFn = () => {
  const permissionsService = inject(PermissionsService);
  return permissionsService.hasAnyPermission(['ticket:add', 'ticket:edit']);
};
