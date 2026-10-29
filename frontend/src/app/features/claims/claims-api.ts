import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '../../core/http/http-context';
import {
  AssignClaimRequest,
  Claim,
  ClaimFilters,
  ClaimHistoryEntry,
  CreateClaimRequest,
  StatusUpdateResponse,
  UpdateStatusRequest,
} from '../../models/claim';

/** Pass for calls whose caller shows the failure itself (a form or dialog), so no snackbar appears too. */
export interface CallOptions {
  inline?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClaimsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/claims`;

  list(filters: ClaimFilters = {}): Observable<Claim[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Claim[]>(this.base, { params });
  }

  get(id: number, options?: CallOptions): Observable<Claim> {
    return this.http.get<Claim>(`${this.base}/${id}`, { context: contextFor(options) });
  }

  history(id: number): Observable<ClaimHistoryEntry[]> {
    return this.http.get<ClaimHistoryEntry[]>(`${this.base}/${id}/history`);
  }

  create(request: CreateClaimRequest): Observable<Claim> {
    return this.http.post<Claim>(this.base, request, { context: contextFor({ inline: true }) });
  }

  assign(id: number, request: AssignClaimRequest): Observable<Claim> {
    return this.http.put<Claim>(`${this.base}/${id}/assignment`, request, {
      context: contextFor({ inline: true }),
    });
  }

  updateStatus(id: number, request: UpdateStatusRequest): Observable<StatusUpdateResponse> {
    return this.http.patch<StatusUpdateResponse>(`${this.base}/${id}/status`, request, {
      context: contextFor({ inline: true }),
    });
  }
}

function contextFor(options?: CallOptions): HttpContext {
  return new HttpContext().set(SKIP_ERROR_NOTIFICATION, options?.inline ?? false);
}
