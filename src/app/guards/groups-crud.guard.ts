import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

export const groupsCrudGuard: CanActivateFn = () => {
  const permissionsService = inject(PermissionsService);

  return permissionsService.hasAnyPermission(['group:add', 'group:edit', 'group:delete']);
};
