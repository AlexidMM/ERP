import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { PanelMenuModule } from 'primeng/panelmenu';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [PanelMenuModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  readonly projectVersion = 'ERP version 4';

  readonly menuItems: MenuItem[] = [
    {
      label: 'Navegación',
      icon: 'pi pi-compass',
      expanded: true,
      items: [
        {
          label: 'Home',
          icon: 'pi pi-home',
          routerLink: '/home'
        },
        {
          label: 'Users',
          icon: 'pi pi-users',
          routerLink: '/home/users'
        },
        {
          label: 'Groups',
          icon: 'pi pi-th-large',
          routerLink: '/home/groups'
        }
      ]
    }
  ];
}
