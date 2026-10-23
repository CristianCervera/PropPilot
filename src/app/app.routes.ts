import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'title.login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'title.home',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'properties',
        title: 'title.properties',
        loadComponent: () =>
          import('./features/properties/properties-list').then((m) => m.PropertiesList),
      },
      {
        path: 'properties/new',
        title: 'title.newProperty',
        loadComponent: () =>
          import('./features/properties/property-form').then((m) => m.PropertyForm),
      },
      {
        path: 'properties/:id/edit',
        title: 'title.editProperty',
        loadComponent: () =>
          import('./features/properties/property-form').then((m) => m.PropertyForm),
      },
      {
        path: 'properties/:id',
        title: 'title.property',
        loadComponent: () =>
          import('./features/properties/property-detail').then((m) => m.PropertyDetailPage),
      },
      {
        path: 'clients',
        title: 'title.clients',
        loadComponent: () => import('./features/clients/clients-board').then((m) => m.ClientsBoard),
      },
      {
        path: 'clients/:id',
        title: 'title.client',
        loadComponent: () =>
          import('./features/clients/client-detail').then((m) => m.ClientDetailPage),
      },
      {
        path: 'agenda',
        title: 'title.agenda',
        loadComponent: () => import('./features/agenda/agenda').then((m) => m.Agenda),
      },
      {
        path: 'copilot',
        title: 'title.copilot',
        loadComponent: () =>
          import('./features/copilot/copilot-page').then((m) => m.CopilotPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
