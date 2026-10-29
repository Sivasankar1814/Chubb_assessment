import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { of, startWith, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth-service';
import { Claim } from '../../models/claim';
import { CLAIM_STATUSES, ClaimStatus } from '../../models/enums';
import { OfficerWorkload } from '../../models/workload';
import { Avatar } from '../../shared/components/avatar';
import { StateMessage } from '../../shared/components/state-message';
import { StatusChip, statusLook } from '../../shared/components/status-chip';
import { WorkloadMeter } from '../../shared/components/workload-meter';
import { LoadState, loadState } from '../../shared/load-state';
import { ClaimsApi } from '../claims/claims-api';
import { IN_PROGRESS } from '../claims/claim-workflow';
import { WorkloadApi } from '../workload/workload-api';
import { ClaimMiniList } from './claim-mini-list';

const SECTION_SIZE = 5;

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    Avatar,
    StateMessage,
    StatusChip,
    WorkloadMeter,
    ClaimMiniList,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly claimsApi = inject(ClaimsApi);
  private readonly workloadApi = inject(WorkloadApi);
  private readonly auth = inject(AuthService);
  private readonly reload = new Subject<void>();

  protected readonly user = this.auth.user;
  protected readonly role = this.auth.role;
  protected readonly statuses = CLAIM_STATUSES;
  /** Stand-ins for the status tiles while the claims load. */
  protected readonly placeholders = CLAIM_STATUSES.map((_, index) => index);
  protected readonly tileColor = (status: ClaimStatus): string => statusLook(status).color;

  protected readonly claims = toSignal(
    this.reload.pipe(
      startWith(undefined),
      switchMap(() => loadState(this.claimsApi.list())),
    ),
    { initialValue: { state: 'loading' } as LoadState<Claim[]> },
  );

  /** Only staff may read workloads; claimants skip the call. */
  protected readonly workload = toSignal(
    this.reload.pipe(
      startWith(undefined),
      switchMap(() =>
        this.auth.isStaff()
          ? loadState(this.workloadApi.all())
          : of<LoadState<OfficerWorkload[]>>({ state: 'ready', data: [] }),
      ),
    ),
    { initialValue: { state: 'loading' } as LoadState<OfficerWorkload[]> },
  );

  protected readonly firstName = computed(() => this.user()?.fullName.split(' ')[0] ?? '');

  private readonly list = computed<Claim[]>(() => {
    const state = this.claims();
    return state.state === 'ready' ? state.data : [];
  });

  protected readonly total = computed(() => this.list().length);

  protected readonly counts = computed(() => {
    const counts = Object.fromEntries(CLAIM_STATUSES.map((s) => [s, 0])) as Record<
      ClaimStatus,
      number
    >;
    for (const claim of this.list()) {
      counts[claim.status]++;
    }
    return counts;
  });

  protected readonly needsReply = computed(() => this.list().filter((c) => c.status === 'ON_HOLD'));

  protected readonly recent = computed(() =>
    [...this.list()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, SECTION_SIZE),
  );

  protected readonly unassigned = computed(() =>
    this.list().filter((c) => c.status === 'OPEN' && c.assignedOfficerId === null),
  );

  protected readonly myActive = computed(() => {
    const me = this.user();
    return this.list().filter(
      (c) => me !== null && c.assignedOfficerId === me.id && IN_PROGRESS.includes(c.status),
    );
  });

  protected readonly myWorkload = computed(() => {
    const state = this.workload();
    const me = this.user();
    return state.state === 'ready' && me
      ? (state.data.find((o) => o.officerId === me.id) ?? null)
      : null;
  });

  protected readonly sectionSize = SECTION_SIZE;
  protected readonly first = (claims: readonly Claim[]): Claim[] => claims.slice(0, SECTION_SIZE);

  protected retry(): void {
    this.reload.next();
  }
}
