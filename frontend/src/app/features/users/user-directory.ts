import { effect, inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth-service';
import { User } from '../../models/user';
import { UsersApi } from './users-api';

/**
 * Who is who, for staff. A claim only carries user ids, and only staff may list users, so this is where an
 * officer id becomes a name and where the claimant picker gets its options. Claimants get an empty directory.
 */
@Injectable({ providedIn: 'root' })
export class UserDirectory {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private cache: Observable<User[]> | undefined;

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.cache = undefined;
      }
    });
  }

  /** Forgets the cached list, so someone just registered shows up in the pickers on the next call. */
  refresh(): void {
    this.cache = undefined;
  }

  /** Never errors: a pick-list that cannot load is empty, and the next call tries again. */
  users(): Observable<User[]> {
    if (!this.auth.isStaff()) {
      return of([]);
    }
    this.cache ??= this.api
      .list()
      .pipe(
        tap({ error: () => (this.cache = undefined) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.cache.pipe(catchError(() => of([] as User[])));
  }

  officers(): Observable<User[]> {
    return this.users().pipe(map((users) => users.filter((u) => u.role === 'OFFICER')));
  }

  claimants(): Observable<User[]> {
    return this.users().pipe(map((users) => users.filter((u) => u.role === 'CLAIMANT')));
  }

  activeClaimants(): Observable<User[]> {
    return this.claimants().pipe(map((users) => users.filter((u) => u.active)));
  }

  names(): Observable<ReadonlyMap<number, string>> {
    return this.users().pipe(map((users) => new Map(users.map((u) => [u.id, u.fullName]))));
  }
}
