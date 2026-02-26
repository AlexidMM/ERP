import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { PanelMenuModule } from 'primeng/panelmenu';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [PanelMenuModule, ButtonModule, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
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
        }
      ]
    }
  ];
}
