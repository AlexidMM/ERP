import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PanelMenuModule } from 'primeng/panelmenu';
import { Router } from '@angular/router';
import { PermissionsService } from '../../services/permissions.service';

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

    if (this.permissionsService.hasPermission('user:view')) {
      items.push({
        label: 'Users',
        icon: 'pi pi-users',
        routerLink: '/home/users'
      });
    }

    if (this.permissionsService.hasPermission('group:view')) {
      items.push({
        label: 'Groups',
        icon: 'pi pi-th-large',
        routerLink: '/home/groups'
      });
    }

    if (this.permissionsService.hasPermission('ticket:view')) {
      items.push({
        label: 'Tickets',
        icon: 'pi pi-ticket',
        routerLink: '/home/tickets'
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
      'group:view',
      'ticket:view'
    ]);
  });

  onLogout(): void {
    this.permissionsService.clearPermissions();
    void this.router.navigateByUrl('/auth/login');
  }
}
