import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PanelMenuModule } from 'primeng/panelmenu';
import { Router } from '@angular/router';
import { PermissionsService } from '../../services/permissions.service';
import { ErpStoreService } from '../../shared/erp-store.service';

@Component({
  selector: 'app-sidebar',
  imports: [PanelMenuModule, ButtonModule, MessageModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly permissionsService = inject(PermissionsService);
  private readonly erpStore = inject(ErpStoreService);

  readonly projectVersion = 'ERP version 4';

  readonly menuItems = computed<MenuItem[]>(() => {
    this.permissionsService.permissions();

    const items: MenuItem[] = [
      {
        label: 'Home',
        icon: 'pi pi-home',
        routerLink: '/home'
      }
    ];

      items.push({
        label: 'Mi perfil',
        icon: 'pi pi-user',
        routerLink: '/home/users'
      });

    if (this.permissionsService.hasPermission('user:add')) {
      items.push({
        label: 'Usuarios y permisos',
        icon: 'pi pi-users',
        routerLink: '/home/lista-users'
      });
    }

    if (this.permissionsService.hasAnyPermission(['group:add', 'group:edit', 'group:delete'])) {
      items.push({
          label: 'Gestionar Grupos',
        icon: 'pi pi-th-large',
        routerLink: '/home/groups'
      });
    }

    return [
      {
        label: 'Navegacion',
        icon: 'pi pi-compass',
        expanded: true,
        items
      }
    ];
  });

  readonly canAccessAnyFeature = computed(() => {
    this.permissionsService.permissions();
    return this.permissionsService.hasAnyPermission([
      'user:view',
      'user:add',
      'group:add',
      'group:edit',
      'group:delete',
      'ticket:add',
      'ticket:edit'
    ]);
  });

  onLogout(): void {
    this.permissionsService.clearPermissions();
    this.erpStore.clearSessionUser();
    this.erpStore.clearSelectedGroup();
    void this.router.navigateByUrl('/auth/login');
  }
}
