import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role-guard';
import { unsavedChangesGuard } from '../../core/auth/unsaved-changes-guard';

// Staff only, the same rule the backend applies. "new" has no id route to clash with, but it stays first like claims.
export const USERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard],
    data: { roles: ['OFFICER', 'MANAGER'] },
    children: [
      {
        path: '',
        title: 'Users · Claims Management',
        loadComponent: () => import('./user-list-page').then((m) => m.UserListPage),
      },
      {
        path: 'new',
        title: 'New user · Claims Management',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./user-create-page').then((m) => m.UserCreatePage),
      },
    ],
  },
];
