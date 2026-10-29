import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { startWith, Subject, switchMap } from 'rxjs';
import { Role, ROLES } from '../../models/enums';
import { User } from '../../models/user';
import { Avatar } from '../../shared/components/avatar';
import { StateMessage } from '../../shared/components/state-message';
import { LoadState, loadState } from '../../shared/load-state';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { MarketName } from '../../shared/pipes/market-name-pipe';
import { UsersApi } from './users-api';

const ROLE_ICONS: Record<Role, string> = {
  CLAIMANT: 'person',
  OFFICER: 'badge',
  MANAGER: 'supervisor_account',
};

/** Everyone who can sign in. Staff only; creating a user is on its own page. */
@Component({
  selector: 'app-user-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    Avatar,
    StateMessage,
    EnumLabel,
    MarketName,
  ],
  templateUrl: './user-list-page.html',
  styleUrl: './user-list-page.scss',
})
export class UserListPage {
  private readonly api = inject(UsersApi);
  private readonly reload = new Subject<void>();

  protected readonly roles = ROLES;
  protected readonly roleIcon = (role: Role): string => ROLE_ICONS[role];
  /** Stand-in rows while the list loads. */
  protected readonly placeholders = [0, 1, 2, 3, 4];

  protected readonly filters = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    role: new FormControl<Role | null>(null),
  });
  private readonly filterValue = toSignal(
    this.filters.valueChanges.pipe(startWith(this.filters.value)),
    { requireSync: true },
  );

  protected readonly result = toSignal(
    this.reload.pipe(
      startWith(undefined),
      switchMap(() => loadState(this.api.list())),
    ),
    { initialValue: { state: 'loading' } as LoadState<User[]> },
  );

  protected readonly hasFilters = computed(() => {
    const { q, role } = this.filterValue();
    return !!q?.trim() || !!role;
  });

  /** Newest first, so someone just registered is at the top. */
  protected readonly rows = computed(() => {
    const state = this.result();
    if (state.state !== 'ready') {
      return [];
    }
    const { q, role } = this.filterValue();
    const term = (q ?? '').trim().toLowerCase();
    return state.data
      .filter(
        (user) =>
          (!role || user.role === role) &&
          (!term ||
            user.fullName.toLowerCase().includes(term) ||
            user.username.toLowerCase().includes(term) ||
            user.email.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  });

  protected retry(): void {
    this.reload.next();
  }

  protected clearFilters(): void {
    this.filters.reset({ q: '', role: null });
  }
}
