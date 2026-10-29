import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '../../core/http/http-context';
import { Role } from '../../models/enums';
import { CreateUserRequest, User } from '../../models/user';

/**
 * Listing needs the OFFICER or MANAGER role; so does creating (either may register a user of any role).
 * Editing and deleting users are not in the app yet.
 */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/users`;

  list(filters: { role?: Role; active?: boolean } = {}): Observable<User[]> {
    let params = new HttpParams();
    if (filters.role) {
      params = params.set('role', filters.role);
    }
    if (filters.active !== undefined) {
      params = params.set('active', String(filters.active));
    }
    return this.http.get<User[]>(this.base, { params });
  }

  /** The form shows the failure itself (a taken username sits on its field), so no snackbar as well. */
  create(request: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.base, request, {
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
    });
  }
}
