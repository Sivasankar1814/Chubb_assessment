import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Claim, StatusUpdateResponse } from '../../models/claim';
import { ClaimAction } from './claim-workflow';
import { StatusChangeDialog } from './status-change-dialog';

const CLAIM: Claim = {
  id: 10,
  claimNumber: 'CLM-2026-000010',
  claimantId: 1,
  claimantName: 'Aiko Tanaka',
  market: 'JP',
  claimType: 'MOTOR',
  description: 'Rear-ended at a junction',
  claimAmount: 1200,
  incidentDate: '2026-09-01',
  status: 'UNDER_REVIEW',
  assignedOfficerId: 3,
  infoRequest: null,
  lastReply: null,
  createdAt: '2026-09-02T10:00:00',
  updatedAt: '2026-09-02T10:00:00',
};

const REJECT: ClaimAction = {
  id: 'reject',
  kind: 'status',
  label: 'Reject',
  icon: 'cancel',
  target: 'REJECTED',
  remarks: 'required',
  remarksLabel: 'Reason for rejection',
  description: 'The claimant will see this reason.',
  tone: 'danger',
};

const APPROVE: ClaimAction = {
  ...REJECT,
  id: 'approve',
  label: 'Approve',
  target: 'APPROVED',
  remarks: 'optional',
};

describe('StatusChangeDialog', () => {
  let http: HttpTestingController;

  function open(action: ClaimAction) {
    const ref: MatDialogRef<StatusChangeDialog, StatusUpdateResponse | null> = TestBed.inject(
      MatDialog,
    ).open(StatusChangeDialog, { data: { claim: CLAIM, action } });
    let closedWith: StatusUpdateResponse | null | undefined;
    ref.afterClosed().subscribe((result) => (closedWith = result));
    return { ref, closedWith: () => closedWith };
  }

  /** Fires a real submit event, as pressing the button does, and returns it so a test can see if it was handled. */
  function submit(): Event {
    const form = document.querySelector('mat-dialog-container form') as HTMLFormElement;
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    TestBed.tick();
    return event;
  }

  function type(text: string) {
    const textarea = document.querySelector('mat-dialog-container textarea') as HTMLTextAreaElement;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    http.verify();
  });

  it('sends the change when the form is submitted, and handles the event itself (no page reload)', async () => {
    const dialog = open(APPROVE);
    TestBed.tick();

    const event = submit();

    // An unhandled submit would reload the whole page and lose the dialog.
    expect(event.defaultPrevented).toBe(true);
    const request = http.expectOne('/api/claims/10/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'APPROVED' });

    request.flush({
      ...CLAIM,
      status: 'APPROVED',
      previousStatus: 'UNDER_REVIEW',
      remarks: null,
      changedBy: 'officer1',
      changedAt: '2026-09-03T09:00:00',
    });
    // afterClosed emits once the dialog's exit animation ends.
    await vi.waitFor(() => expect(dialog.closedWith()?.status).toBe('APPROVED'));
  });

  it('does not call the server until the required reason is given', async () => {
    open(REJECT);
    TestBed.tick();

    submit();
    http.expectNone('/api/claims/10/status');
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain(
      'This is required',
    );

    type('Not covered by the policy');
    submit();
    expect(http.expectOne('/api/claims/10/status').request.body).toEqual({
      status: 'REJECTED',
      remarks: 'Not covered by the policy',
    });
  });

  it('stays open and shows the reason when the server refuses the move', async () => {
    const dialog = open(APPROVE);
    TestBed.tick();

    submit();
    http
      .expectOne('/api/claims/10/status')
      .flush(
        { status: 409, message: 'Cannot move claim from CLOSED to APPROVED' },
        { status: 409, statusText: 'Conflict' },
      );
    TestBed.tick();

    expect(dialog.closedWith()).toBeUndefined();
    expect(document.querySelector('mat-dialog-container [role="alert"]')?.textContent).toContain(
      'Cannot move claim from CLOSED to APPROVED',
    );
  });
});
