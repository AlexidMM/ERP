import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

export const usersManagementGuard: CanActivateFn = () => {
  const permissionsService = inject(PermissionsService);

  return permissionsService.hasPermission('user:add');
};