import { Routes } from '@angular/router';
import { groupsCrudGuard } from './guards/groups-crud.guard';
import { usersManagementGuard } from './guards/users-management.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'landing' },

  {
    path: 'landing',
    loadComponent: () =>
      import('./pages/landing/landing').then((m) => m.LandingComponent)
  },

  {
    path: 'home',
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users').then((m) => m.UsersComponent)
      },
      {
        path: 'lista-users',
        canActivate: [usersManagementGuard],
        loadComponent: () =>
          import('./pages/listaUsers/listaUsers').then((m) => m.ListaUsersComponent)
      },
      {
        path: 'groups',
        canActivate: [groupsCrudGuard],
        loadComponent: () => import('./pages/groups/groups').then((m) => m.GroupsComponent)
      },
      {
        path: 'tickets',
        loadComponent: () => import('./pages/tickets/tickets').then((m) => m.TicketsComponent)
      }
    ]
  },

  {
    path: 'auth',
    loadComponent: () =>
      import('./pages/auth/layout/auth-layout').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/auth/login/login').then((m) => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/auth/register/register').then((m) => m.RegisterComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'landing' }
];
