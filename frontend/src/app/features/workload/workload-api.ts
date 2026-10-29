import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '../../core/http/http-context';
import { OfficerWorkload } from '../../models/workload';

@Injectable({ providedIn: 'root' })
export class WorkloadApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/workload`;

  /** Every active officer, least utilised first. OFFICER or MANAGER. */
  all(): Observable<OfficerWorkload[]> {
    return this.http.get<OfficerWorkload[]>(this.base);
  }

  forOfficer(officerId: number): Observable<OfficerWorkload> {
    return this.http.get<OfficerWorkload>(`${this.base}/${officerId}`);
  }

  /** The best officer for the next claim. MANAGER only; a nice-to-have, so a failure stays quiet. */
  suggestion(): Observable<OfficerWorkload> {
    return this.http.get<OfficerWorkload>(`${this.base}/suggestion`, {
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
    });
  }
}
