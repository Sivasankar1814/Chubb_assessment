import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { toApiProblem } from '../../core/http/api-problem';
import { Claim, StatusUpdateResponse } from '../../models/claim';
import { notBlank } from '../../shared/validators/claim-validators';
import { ClaimAction } from './claim-workflow';
import { ClaimsApi } from './claims-api';

export interface StatusChangeDialogData {
  claim: Claim;
  action: ClaimAction;
}

const MAX_REMARKS = 500;

@Component({
  selector: 'app-status-change-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.action.label }}</h2>
    @if (submitting()) {
      <mat-progress-bar mode="indeterminate" aria-label="Saving" />
    }
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="description">{{ data.action.description }}</p>

        @if (data.claim.infoRequest && data.action.id === 'reply') {
          <blockquote class="request">
            <span class="muted">{{ data.claim.infoRequest.requestedBy }} asked:</span>
            {{ data.claim.infoRequest.message }}
          </blockquote>
        }

        @if (error(); as message) {
          <div class="inline-error" role="alert">
            <mat-icon aria-hidden="true">error_outline</mat-icon>
            <span>{{ message }}</span>
          </div>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ data.action.remarksLabel }}</mat-label>
          <textarea
            matInput
            rows="4"
            formControlName="remarks"
            [maxlength]="maxRemarks"
            [required]="data.action.remarks === 'required'"
          ></textarea>
          <mat-hint align="end">{{ remarks.value.length }} / {{ maxRemarks }}</mat-hint>
          @if (remarks.hasError('required')) {
            <mat-error>This is required</mat-error>
          } @else if (remarks.hasError('server')) {
            <mat-error>{{ remarks.getError('server') }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" [mat-dialog-close]="null" [disabled]="submitting()">
          Cancel
        </button>
        <button
          matButton="filled"
          type="submit"
          [class.danger]="data.action.tone === 'danger'"
          [disabled]="submitting()"
        >
          {{ data.action.label }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .description {
      margin-top: 0;
    }

    .request {
      margin: 0 0 16px;
      padding: 8px 12px;
      border-left: 3px solid var(--app-warning);
      background: var(--mat-sys-surface-container-high);
      border-radius: 0 var(--mat-sys-corner-small) var(--mat-sys-corner-small) 0;
    }

    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class StatusChangeDialog {
  protected readonly data = inject<StatusChangeDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<StatusChangeDialog, StatusUpdateResponse | null>>(MatDialogRef);
  private readonly api = inject(ClaimsApi);

  protected readonly maxRemarks = MAX_REMARKS;
  protected readonly remarks = new FormControl('', {
    nonNullable: true,
    validators:
      this.data.action.remarks === 'required'
        ? [Validators.required, notBlank, Validators.maxLength(MAX_REMARKS)]
        : [Validators.maxLength(MAX_REMARKS)],
  });
  // The form needs a group: without one nothing handles the submit event and the browser reloads the page.
  protected readonly form = new FormGroup({ remarks: this.remarks });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.remarks.invalid) {
      this.remarks.markAsTouched();
      return;
    }
    const target = this.data.action.target;
    if (!target) {
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.ref.disableClose = true;

    const remarks = this.remarks.value.trim();
    this.api
      .updateStatus(this.data.claim.id, { status: target, remarks: remarks || undefined })
      .subscribe({
        next: (response) => this.ref.close(response),
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          const fieldMessage = problem.fieldErrors['remarks'];
          if (fieldMessage) {
            this.remarks.setErrors({ server: fieldMessage });
            this.remarks.markAsTouched();
          } else {
            this.error.set(problem.message);
          }
          this.submitting.set(false);
          this.ref.disableClose = false;
        },
      });
  }
}
