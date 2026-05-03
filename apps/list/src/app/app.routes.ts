import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'list/:id',
    loadComponent: () =>
      import('./list-detail/list-detail.component').then((m) => m.ListDetailComponent),
    canActivate: [authGuard],
  },
  {
    path: 'share/:token',
    loadComponent: () => import('./share/share.component').then((m) => m.ShareComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
