import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { startWith, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth-service';
import { OfficerWorkload } from '../../models/workload';
import { Avatar } from '../../shared/components/avatar';
import { StateMessage } from '../../shared/components/state-message';
import { WorkloadMeter } from '../../shared/components/workload-meter';
import { LoadState, loadState } from '../../shared/load-state';
import { WorkloadApi } from './workload-api';

@Component({
  selector: 'app-workload-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    Avatar,
    StateMessage,
    WorkloadMeter,
  ],
  templateUrl: './workload-page.html',
  styleUrl: './workload-page.scss',
})
export class WorkloadPage {
  private readonly api = inject(WorkloadApi);
  private readonly reload = new Subject<void>();

  protected readonly me = inject(AuthService).user;
  protected readonly state = toSignal(
    this.reload.pipe(
      startWith(undefined),
      switchMap(() => loadState(this.api.all())),
    ),
    { initialValue: { state: 'loading' } as LoadState<OfficerWorkload[]> },
  );

  protected readonly totals = computed(() => {
    const current = this.state();
    if (current.state !== 'ready') {
      return null;
    }
    const capacity = current.data.reduce((sum, o) => sum + o.maxCapacity, 0);
    const open = current.data.reduce((sum, o) => sum + o.openClaims, 0);
    return { officers: current.data.length, capacity, open, available: capacity - open };
  });

  protected retry(): void {
    this.reload.next();
  }
}
