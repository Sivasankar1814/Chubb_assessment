import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/auth/unsaved-changes-guard';

// "new" must come before ":id", or it would be read as a claim id.
export const CLAIMS_ROUTES: Routes = [
  {
    path: '',
    title: 'Claims · Claims Management',
    loadComponent: () => import('./claim-list-page').then((m) => m.ClaimListPage),
  },
  {
    path: 'new',
    title: 'File a claim · Claims Management',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./claim-create-page').then((m) => m.ClaimCreatePage),
  },
  {
    path: ':id',
    title: 'Claim · Claims Management',
    loadComponent: () => import('./claim-detail-page').then((m) => m.ClaimDetailPage),
  },
];
