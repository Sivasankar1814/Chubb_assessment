import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  Subject,
  startWith,
  switchMap,
} from 'rxjs';
import { AuthService } from '../../core/auth/auth-service';
import { NotificationService } from '../../core/notifications/notification-service';
import { Claim, ClaimFilters } from '../../models/claim';
import {
  CLAIM_STATUSES,
  CLAIM_TYPES,
  ClaimStatus,
  ClaimType,
  MARKETS,
  Market,
} from '../../models/enums';
import { StateMessage } from '../../shared/components/state-message';
import { StatusChip } from '../../shared/components/status-chip';
import { LoadState, loadState } from '../../shared/load-state';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { MarketName } from '../../shared/pipes/market-name-pipe';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { UserDirectory } from '../users/user-directory';
import { AssignOfficerDialog, AssignOfficerDialogData } from './assign-officer-dialog';
import { canAssign, handledByManager } from './claim-workflow';
import { ClaimsApi } from './claims-api';

/** The filters as the URL carries them, so a filtered list can be bookmarked and linked to from the dashboard. */
interface FilterValues {
  q: string;
  status: ClaimStatus | null;
  claimType: ClaimType | null;
  market: Market | null;
  claimantId: number | null;
  assignedOfficerId: number | null;
  unassigned: boolean;
}

const ALL_COLUMNS = [
  'claimNumber',
  'claimantName',
  'claimType',
  'market',
  'status',
  'claimAmount',
  'assignedOfficer',
  'updatedAt',
] as const;

@Component({
  selector: 'app-claim-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MoneyPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSortModule,
    MatTableModule,
    StatusChip,
    StateMessage,
    EnumLabel,
    MarketName,
  ],
  templateUrl: './claim-list-page.html',
  styleUrl: './claim-list-page.scss',
})
export class ClaimListPage {
  private readonly api = inject(ClaimsApi);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(UserDirectory);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new Subject<void>();

  /** Only a manager assigns claims, so only a manager gets the Assign column. */
  protected readonly isManager = this.auth.hasRole('MANAGER');

  protected readonly statuses = CLAIM_STATUSES;
  /** Stand-in rows while the claims load. */
  protected readonly placeholders = [0, 1, 2, 3, 4];
  protected readonly types = CLAIM_TYPES;
  protected readonly markets = MARKETS;
  protected readonly isStaff = this.auth.isStaff;
  protected readonly officers = toSignal(this.directory.officers(), { initialValue: [] });
  protected readonly claimants = toSignal(this.directory.claimants(), { initialValue: [] });
  private readonly names = toSignal(this.directory.names(), {
    initialValue: new Map<number, string>(),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    q: [''],
    status: [null as ClaimStatus | null],
    claimType: [null as ClaimType | null],
    market: [null as Market | null],
    claimantId: [null as number | null],
    assignedOfficerId: [null as number | null],
    unassigned: [false],
  });

  private readonly viewport = toSignal(
    inject(BreakpointObserver)
      .observe(['(max-width: 640px)', '(max-width: 1024px)', '(max-width: 1280px)'])
      .pipe(
        map((state) => ({
          phone: state.breakpoints['(max-width: 640px)'],
          tablet: state.breakpoints['(max-width: 1024px)'],
          laptop: state.breakpoints['(max-width: 1280px)'],
        })),
      ),
    { initialValue: { phone: false, tablet: false, laptop: false } },
  );

  protected readonly isPhone = computed(() => this.viewport().phone);
  /** On a phone only the search box shows until the filters are opened. */
  protected readonly filtersOpen = signal(false);

  protected readonly columns = computed<string[]>(() => {
    const { phone, tablet, laptop } = this.viewport();
    const staff = this.isStaff();
    // The claim cell carries the claimant and amount underneath, so two columns fit a phone.
    if (phone) {
      return ['claimNumber', 'status'];
    }
    const wide = ALL_COLUMNS.filter((c) =>
      c === 'claimantName' || c === 'assignedOfficer' ? staff : true,
    );
    // Narrower screens give up columns, least needed first: the currency symbol already says the country, so Market
    // goes first (laptops); the officer goes too on a tablet.
    const shown = tablet
      ? wide.filter((c) => c !== 'market' && c !== 'assignedOfficer')
      : laptop
        ? wide.filter((c) => c !== 'market')
        : wide;
    // On a phone there is no room for it; the claim's own page has the same Assign button.
    return this.isManager ? [...shown, 'actions'] : shown;
  });

  private readonly filters = this.route.queryParamMap.pipe(map((params) => parse(params)));

  protected readonly result = toSignal(
    combineLatest([
      this.filters.pipe(
        map((f) => serverFilters(f, this.isStaff())),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      ),
      this.reload.pipe(startWith(undefined)),
    ]).pipe(switchMap(([server]) => loadState(this.api.list(server)))),
    { initialValue: { state: 'loading' } as LoadState<Claim[]> },
  );

  private readonly applied = toSignal(this.filters, { requireSync: false });

  protected readonly rows = computed(() => {
    const result = this.result();
    const applied = this.applied();
    if (result.state !== 'ready' || !applied) {
      return [];
    }
    const term = applied.q.trim().toLowerCase();
    return result.data.filter(
      (claim) =>
        (!applied.unassigned || claim.assignedOfficerId === null) &&
        (!term ||
          claim.claimNumber.toLowerCase().includes(term) ||
          claim.claimantName.toLowerCase().includes(term) ||
          claim.description.toLowerCase().includes(term)),
    );
  });

  protected readonly hasFilters = computed(() => {
    const f = this.applied();
    return (
      !!f &&
      (f.q !== '' || f.unassigned || Object.keys(serverFilters(f, this.isStaff())).length > 0)
    );
  });

  /** How many filters besides the search box are set: the number on the phone's Filters button. */
  protected readonly activeFilterCount = computed(() => {
    const f = this.applied();
    if (!f) {
      return 0;
    }
    return Object.keys(serverFilters(f, this.isStaff())).length + (f.unassigned ? 1 : 0);
  });

  protected readonly dataSource = new MatTableDataSource<Claim>([]);
  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    this.filters
      .pipe(takeUntilDestroyed())
      .subscribe((f) =>
        this.form.patchValue(
          { q: f.q, unassigned: f.unassigned, ...f.fields },
          { emitEvent: false },
        ),
      );

    this.form.valueChanges.pipe(debounceTime(250), takeUntilDestroyed()).subscribe((value) => {
      if (value.unassigned && value.assignedOfficerId) {
        this.form.patchValue({ assignedOfficerId: null }, { emitEvent: false });
        value = { ...value, assignedOfficerId: null };
      }
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: toQueryParams(value),
        replaceUrl: true,
      });
    });

    effect(() => {
      this.dataSource.data = this.rows();
      this.dataSource.sort = this.sort() ?? null;
      this.dataSource.paginator = this.paginator() ?? null;
    });
  }

  protected retry(): void {
    this.reload.next();
  }

  protected clearFilters(): void {
    this.form.reset();
  }

  /** A manager may assign a claim that is open or in progress, and reassign one that already has an officer. */
  protected canAssign(claim: Claim): boolean {
    const me = this.auth.user();
    return me !== null && canAssign(claim, { id: me.id, role: 'MANAGER' });
  }

  /** The same dialog as on the claim's page, so a manager can hand claims out without opening each one. */
  protected assign(claim: Claim): void {
    const data: AssignOfficerDialogData = { claim };
    this.dialog
      .open(AssignOfficerDialog, { data, width: '560px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe((updated) => {
        if (!updated) {
          return;
        }
        this.notify.success(`${updated.claimNumber} assigned to ${this.officerName(updated)}.`);
        this.reload.next();
      });
  }

  /** Makes the whole row a target. The claim number stays a real link, so keyboard users and modifier-clicks use that. */
  protected open(claim: Claim, event: MouseEvent): void {
    if (event.defaultPrevented || (event.target as HTMLElement).closest('a, button')) {
      return;
    }
    void this.router.navigate(['/claims', claim.id]);
  }

  protected readonly handledByManager = handledByManager;

  protected officerName(claim: Claim): string {
    if (claim.assignedOfficerId === null) {
      return handledByManager(claim) ? 'Manager' : 'Unassigned';
    }
    return (
      this.names().get(claim.assignedOfficerId) ??
      (this.isStaff() ? `Officer #${claim.assignedOfficerId}` : 'Assigned')
    );
  }
}

function parse(params: ParamMap): {
  q: string;
  unassigned: boolean;
  fields: Omit<FilterValues, 'q' | 'unassigned'>;
} {
  const number = (key: string): number | null => {
    const value = Number(params.get(key));
    return params.get(key) && Number.isInteger(value) && value > 0 ? value : null;
  };
  const member = <T extends string>(key: string, allowed: readonly T[]): T | null =>
    allowed.find((item) => item === params.get(key)) ?? null;

  return {
    q: params.get('q') ?? '',
    unassigned: params.get('unassigned') === 'true',
    fields: {
      status: member('status', CLAIM_STATUSES),
      claimType: member('type', CLAIM_TYPES),
      market: member('market', MARKETS),
      claimantId: number('claimant'),
      assignedOfficerId: number('officer'),
    },
  };
}

/** Only these go to the server; text search and "unassigned" are applied to the list in the browser. */
function serverFilters(f: ReturnType<typeof parse>, staff: boolean): ClaimFilters {
  const filters: ClaimFilters = {};
  if (f.fields.status) filters.status = f.fields.status;
  if (f.fields.claimType) filters.claimType = f.fields.claimType;
  if (f.fields.market) filters.market = f.fields.market;
  if (staff && f.fields.claimantId) filters.claimantId = f.fields.claimantId;
  if (staff && f.fields.assignedOfficerId) filters.assignedOfficerId = f.fields.assignedOfficerId;
  return filters;
}

function toQueryParams(value: Partial<FilterValues>): Record<string, string | null> {
  return {
    q: value.q?.trim() || null,
    status: value.status ?? null,
    type: value.claimType ?? null,
    market: value.market ?? null,
    claimant: value.claimantId ? String(value.claimantId) : null,
    officer: value.assignedOfficerId ? String(value.assignedOfficerId) : null,
    unassigned: value.unassigned ? 'true' : null,
  };
}
