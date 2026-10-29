import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { guestGuard } from './core/auth/guest-guard';
import { roleGuard } from './core/auth/role-guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Claims Management',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · Claims Management',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'claims',
        loadChildren: () => import('./features/claims/claims.routes').then((m) => m.CLAIMS_ROUTES),
      },
      {
        path: 'workload',
        title: 'Workload · Claims Management',
        canActivate: [roleGuard],
        data: { roles: ['OFFICER', 'MANAGER'] },
        loadComponent: () =>
          import('./features/workload/workload-page').then((m) => m.WorkloadPage),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'profile',
        title: 'Profile · Claims Management',
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'forbidden',
        title: 'No access · Claims Management',
        loadComponent: () =>
          import('./features/errors/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: 'Not found · Claims Management',
        loadComponent: () => import('./features/errors/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
