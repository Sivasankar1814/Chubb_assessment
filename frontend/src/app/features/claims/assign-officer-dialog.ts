import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { catchError, map, of } from 'rxjs';
import { toApiProblem } from '../../core/http/api-problem';
import { Claim } from '../../models/claim';
import { OfficerWorkload } from '../../models/workload';
import { StateMessage } from '../../shared/components/state-message';
import { WorkloadMeter } from '../../shared/components/workload-meter';
import { loadState, LoadState } from '../../shared/load-state';
import { WorkloadApi } from '../workload/workload-api';
import { ClaimsApi } from './claims-api';

export interface AssignOfficerDialogData {
  claim: Claim;
}

const MAX_REMARKS = 500;

@Component({
  selector: 'app-assign-officer-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatRadioModule,
    StateMessage,
    WorkloadMeter,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.claim.assignedOfficerId ? 'Reassign claim' : 'Assign claim' }}</h2>
    @if (submitting()) {
      <mat-progress-bar mode="indeterminate" aria-label="Saving" />
    }
    <mat-dialog-content>
      <p class="intro">
        Choose an officer for <strong>{{ data.claim.claimNumber }}</strong
        >. Officers at capacity cannot take more claims.
      </p>

      @if (error(); as message) {
        <div class="inline-error" role="alert">
          <mat-icon aria-hidden="true">error_outline</mat-icon>
          <span>{{ message }}</span>
        </div>
      }

      @let current = officers();
      @if (current.state === 'loading') {
        <mat-progress-bar mode="indeterminate" aria-label="Loading officers" />
      } @else if (current.state === 'error') {
        <app-state-message
          kind="error"
          title="Couldn't load officers"
          [message]="current.problem.message"
        />
      } @else if (current.data.length === 0) {
        <app-state-message
          title="No active officers"
          message="Ask a manager to activate or add an officer."
        />
      } @else {
        <mat-radio-group
          class="officers"
          aria-label="Officers"
          [value]="selected()"
          (change)="selected.set($event.value)"
        >
          @for (officer of current.data; track officer.officerId) {
            <mat-radio-button
              class="officer"
              [value]="officer.officerId"
              [disabled]="!canPick(officer)"
              [class.selected]="selected() === officer.officerId"
            >
              <span class="body">
                <span class="name">
                  {{ officer.fullName }}
                  @if (officer.officerId === suggestedId()) {
                    <span class="tag">Suggested</span>
                  }
                  @if (officer.officerId === data.claim.assignedOfficerId) {
                    <span class="tag">Current</span>
                  }
                </span>
                @if (officer.specialization) {
                  <span class="muted">{{ officer.specialization }}</span>
                }
                <app-workload-meter [workload]="officer" />
              </span>
            </mat-radio-button>
          }
        </mat-radio-group>
      }

      <mat-form-field appearance="outline" class="remarks">
        <mat-label>Note (optional)</mat-label>
        <textarea matInput rows="2" [formControl]="remarks" [maxlength]="maxRemarks"></textarea>
        <mat-hint align="end">{{ remarks.value.length }} / {{ maxRemarks }}</mat-hint>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="null" [disabled]="submitting()">
        Cancel
      </button>
      <button
        matButton="filled"
        type="button"
        [disabled]="selected() === null || submitting()"
        (click)="submit()"
      >
        {{ data.claim.assignedOfficerId ? 'Reassign' : 'Assign' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .intro {
      margin-top: 0;
    }

    .officers {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .officer {
      display: block;
      padding: 4px 12px 8px 0;
      border: 1px solid var(--app-border);
      border-radius: var(--mat-sys-corner-large);
      transition:
        border-color var(--app-fast) var(--app-ease),
        background var(--app-fast) var(--app-ease);

      &:hover:not(.selected) {
        border-color: color-mix(in srgb, var(--mat-sys-primary) 45%, var(--app-border));
      }

      &.selected {
        border-color: var(--mat-sys-primary);
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
    }

    // The radio's own label is shrink-to-fit; stretch it so the meter spans the row.
    .officer ::ng-deep .mdc-form-field {
      display: flex;
      align-items: flex-start;
      width: 100%;
    }

    .officer ::ng-deep .mdc-label {
      flex: 1;
      min-width: 0;
      padding-top: 10px;
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .name {
      font: var(--mat-sys-title-small);
    }

    .tag {
      margin-left: 6px;
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid var(--app-border);
      font: var(--mat-sys-label-small);
    }

    .remarks {
      margin-top: 16px;
    }
  `,
})
export class AssignOfficerDialog {
  protected readonly data = inject<AssignOfficerDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AssignOfficerDialog, Claim | null>>(MatDialogRef);
  private readonly claims = inject(ClaimsApi);
  private readonly workload = inject(WorkloadApi);

  protected readonly maxRemarks = MAX_REMARKS;
  protected readonly remarks = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(MAX_REMARKS)],
  });
  protected readonly officers = toSignal(loadState(this.workload.all()), {
    initialValue: { state: 'loading' } as LoadState<OfficerWorkload[]>,
  });
  protected readonly suggestedId = toSignal(
    this.workload.suggestion().pipe(
      map((suggested) => suggested.officerId),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );
  protected readonly selected = signal<number | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Start from the suggestion, unless the manager already chose someone or the suggestion cannot take it.
    effect(() => {
      const list = this.officers();
      const suggested = this.suggestedId();
      if (list.state === 'ready' && suggested !== null && this.selected() === null) {
        const candidate = list.data.find((officer) => officer.officerId === suggested);
        if (candidate && this.canPick(candidate)) {
          this.selected.set(candidate.officerId);
        }
      }
    });
  }

  protected canPick(officer: OfficerWorkload): boolean {
    return officer.level !== 'FULL' && officer.officerId !== this.data.claim.assignedOfficerId;
  }

  protected submit(): void {
    const officerId = this.selected();
    if (officerId === null || this.remarks.invalid) {
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.ref.disableClose = true;

    const remarks = this.remarks.value.trim();
    this.claims.assign(this.data.claim.id, { officerId, remarks: remarks || undefined }).subscribe({
      next: (claim) => this.ref.close(claim),
      error: (err: unknown) => {
        this.error.set(toApiProblem(err).message);
        this.submitting.set(false);
        this.ref.disableClose = false;
      },
    });
  }
}
