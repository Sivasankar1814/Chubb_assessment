import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { map, merge, of, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth-service';
import { NotificationService } from '../../core/notifications/notification-service';
import { Claim, ClaimHistoryEntry } from '../../models/claim';
import { StateMessage } from '../../shared/components/state-message';
import { StatusChip } from '../../shared/components/status-chip';
import { LoadState, loadState } from '../../shared/load-state';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { MarketName } from '../../shared/pipes/market-name-pipe';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { UserDirectory } from '../users/user-directory';
import { AssignOfficerDialog, AssignOfficerDialogData } from './assign-officer-dialog';
import { availableActions, canAssign, ClaimAction, handledByManager } from './claim-workflow';
import { ClaimsApi } from './claims-api';
import { HistoryTimeline } from './history-timeline';
import { StatusChangeDialog, StatusChangeDialogData } from './status-change-dialog';

@Component({
  selector: 'app-claim-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    StatusChip,
    StateMessage,
    HistoryTimeline,
    EnumLabel,
    MarketName,
  ],
  templateUrl: './claim-detail-page.html',
  styleUrl: './claim-detail-page.scss',
})
export class ClaimDetailPage {
  private readonly api = inject(ClaimsApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotificationService);
  private readonly directory = inject(UserDirectory);
  private readonly refresh = new Subject<void>();

  /** Bound from the :id route parameter. */
  readonly id = input.required<string>();

  protected readonly claim = signal<LoadState<Claim>>({ state: 'loading' });
  protected readonly history = signal<LoadState<ClaimHistoryEntry[]>>({ state: 'loading' });
  private readonly names = toSignal(this.directory.names(), {
    initialValue: new Map<number, string>(),
  });

  protected readonly me = this.auth.user;
  protected readonly isStaff = this.auth.isStaff;

  protected readonly actor = computed(() => {
    const user = this.me();
    return user ? { id: user.id, role: user.role } : null;
  });

  protected readonly actions = computed<ClaimAction[]>(() => {
    const state = this.claim();
    const actor = this.actor();
    return state.state === 'ready' && actor ? availableActions(state.data, actor) : [];
  });

  protected readonly assignable = computed(() => {
    const state = this.claim();
    const actor = this.actor();
    return state.state === 'ready' && actor !== null && canAssign(state.data, actor);
  });

  constructor() {
    merge(toObservable(this.id), this.refresh.pipe(map(() => this.id())))
      .pipe(
        switchMap((id) => {
          this.history.set({ state: 'loading' });
          const claimId = Number(id);
          if (!Number.isInteger(claimId) || claimId <= 0) {
            return of<LoadState<Claim>>({
              state: 'error',
              problem: {
                status: 404,
                message: "We couldn't find that claim.",
                details: [],
                fieldErrors: {},
              },
            });
          }
          return loadState(this.api.get(claimId, { inline: true }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.claim.set(state);
        if (state.state === 'ready') {
          this.loadHistory(state.data.id);
        }
      });
  }

  protected retry(): void {
    this.refresh.next();
  }

  protected errorTitle(status: number): string {
    switch (status) {
      case 404:
        return 'Claim not found';
      case 403:
        return 'You cannot open this claim';
      default:
        return "Couldn't load this claim";
    }
  }

  protected readonly handledByManager = handledByManager;

  protected officerName(claim: Claim): string {
    if (claim.assignedOfficerId === null) {
      if (handledByManager(claim)) {
        return this.isStaff()
          ? 'A manager (no officer assigned)'
          : 'A manager is handling this claim';
      }
      return 'Not assigned yet';
    }
    return (
      this.names().get(claim.assignedOfficerId) ??
      (this.isStaff() ? `Officer #${claim.assignedOfficerId}` : 'An officer is handling this claim')
    );
  }

  /** The claimant who owns this claim is asked to act when it is on hold. */
  protected awaitingMyReply(claim: Claim): boolean {
    return claim.status === 'ON_HOLD' && claim.claimantId === this.me()?.id && !this.isStaff();
  }

  protected openAction(claim: Claim, action: ClaimAction): void {
    const data: StatusChangeDialogData = { claim, action };
    this.dialog
      .open(StatusChangeDialog, { data, width: '520px', maxWidth: '94vw', autoFocus: 'textarea' })
      .afterClosed()
      .subscribe((updated) => {
        if (!updated) {
          return;
        }
        this.claim.set({ state: 'ready', data: updated });
        this.loadHistory(updated.id);
        this.notify.success(this.statusMessage(action, updated));
      });
  }

  protected openAssign(claim: Claim): void {
    const data: AssignOfficerDialogData = { claim };
    this.dialog
      .open(AssignOfficerDialog, { data, width: '560px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe((updated) => {
        if (!updated) {
          return;
        }
        this.claim.set({ state: 'ready', data: updated });
        this.loadHistory(updated.id);
        this.notify.success(`${updated.claimNumber} assigned to ${this.officerName(updated)}.`);
      });
  }

  private loadHistory(id: number): void {
    loadState(this.api.history(id)).subscribe((state) => this.history.set(state));
  }

  private statusMessage(action: ClaimAction, claim: Claim): string {
    switch (action.id) {
      case 'reply':
        return `Thanks. Your reply on ${claim.claimNumber} was sent and the review has resumed.`;
      case 'hold':
        return `${claim.claimNumber} is on hold until the claimant replies.`;
      default:
        return `${claim.claimNumber} is now ${new EnumLabel().transform(claim.status).toLowerCase()}.`;
    }
  }
}
