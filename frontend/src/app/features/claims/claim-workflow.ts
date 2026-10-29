import { Claim } from '../../models/claim';
import { ClaimStatus, Role } from '../../models/enums';

/**
 * The claim workflow as the UI offers it. This mirrors ClaimStatus and ClaimService in the backend so the
 * screen only shows moves that can work. It is a convenience, not the rule: the server decides, and a 403 or
 * 409 always wins over what is shown here.
 */
export const TRANSITIONS: Readonly<Record<ClaimStatus, readonly ClaimStatus[]>> = {
  // OPEN to UNDER_REVIEW is a manager's move: they may review a claim themselves, with no officer. An officer picks a
  // claim up first (which assigns it to them), so theirs starts from ASSIGNED.
  OPEN: ['ASSIGNED', 'UNDER_REVIEW', 'CLOSED'],
  ASSIGNED: ['UNDER_REVIEW', 'CLOSED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'ON_HOLD'],
  ON_HOLD: ['UNDER_REVIEW', 'CLOSED'],
  APPROVED: ['SETTLED'],
  REJECTED: ['CLOSED'],
  SETTLED: ['CLOSED'],
  CLOSED: [],
};

/** Statuses in which a claim counts towards an officer's workload. */
export const IN_PROGRESS: readonly ClaimStatus[] = ['ASSIGNED', 'UNDER_REVIEW', 'ON_HOLD'];

export interface ClaimAction {
  id: string;
  kind: 'status' | 'assign';
  label: string;
  icon: string;
  /** The status to send, for kind "status". */
  target?: ClaimStatus;
  remarks: 'required' | 'optional';
  remarksLabel: string;
  /** Short text shown in the dialog to explain what happens. */
  description: string;
  tone: 'primary' | 'neutral' | 'danger';
}

export interface Actor {
  id: number;
  role: Role;
}

export function availableActions(claim: Claim, actor: Actor): ClaimAction[] {
  switch (actor.role) {
    case 'CLAIMANT':
      return claimantActions(claim, actor);
    case 'OFFICER':
      return officerActions(claim, actor);
    case 'MANAGER':
      return managerActions(claim);
  }
}

/** A manager may assign (or reassign) a claim that is open or in progress. */
export function canAssign(claim: Claim, actor: Actor): boolean {
  return (
    actor.role === 'MANAGER' && (claim.status === 'OPEN' || IN_PROGRESS.includes(claim.status))
  );
}

function claimantActions(claim: Claim, actor: Actor): ClaimAction[] {
  if (claim.claimantId !== actor.id || claim.status !== 'ON_HOLD') {
    return [];
  }
  return [
    {
      id: 'reply',
      kind: 'status',
      label: 'Provide information',
      icon: 'reply',
      target: 'UNDER_REVIEW',
      remarks: 'required',
      remarksLabel: 'Your reply',
      description: 'Answer the request below. Your claim goes straight back under review.',
      tone: 'primary',
    },
  ];
}

function officerActions(claim: Claim, actor: Actor): ClaimAction[] {
  const mine = claim.assignedOfficerId === actor.id;
  const pickUp = claim.assignedOfficerId === null && claim.status === 'OPEN';
  if (!mine && !pickUp) {
    return [];
  }
  // Moving an unassigned OPEN claim assigns it to the officer first, so its next step starts from ASSIGNED.
  return staffTargets(pickUp ? 'ASSIGNED' : claim.status).map((target) =>
    staffAction(target, pickUp),
  );
}

/**
 * A manager can do everything an officer can, on any claim. On an open claim they may start the review themselves, with
 * no officer assigned, and carry it all the way to settlement; assigning one stays available at any point.
 */
function managerActions(claim: Claim): ClaimAction[] {
  const direct = claim.status === 'OPEN';
  return staffTargets(claim.status).map((target) => staffAction(target, false, direct));
}

/** A claim that is past OPEN with no officer is being handled by a manager directly. */
export function handledByManager(claim: Claim): boolean {
  return claim.assignedOfficerId === null && claim.status !== 'OPEN';
}

/**
 * Where staff can take a claim from `from`. ASSIGNED only ever comes from the assignment endpoint, and a claim
 * on hold can only be closed: it resumes when the claimant answers.
 */
function staffTargets(from: ClaimStatus): ClaimStatus[] {
  if (from === 'ON_HOLD') {
    return ['CLOSED'];
  }
  return TRANSITIONS[from].filter((status) => status !== 'ASSIGNED');
}

function staffAction(target: ClaimStatus, pickUp: boolean, direct = false): ClaimAction {
  switch (target) {
    case 'UNDER_REVIEW':
      return {
        id: 'review',
        kind: 'status',
        label: pickUp ? 'Pick up and start review' : 'Start review',
        icon: 'rate_review',
        target,
        remarks: 'optional',
        remarksLabel: 'Notes (optional)',
        description: pickUp
          ? 'This assigns the claim to you and starts the review. It counts towards your capacity.'
          : direct
            ? 'Review this claim yourself, with no officer assigned. You can still hand it to an officer later.'
            : 'Move this claim into review.',
        tone: 'primary',
      };
    case 'APPROVED':
      return {
        id: 'approve',
        kind: 'status',
        label: 'Approve',
        icon: 'check_circle',
        target,
        remarks: 'optional',
        remarksLabel: 'Notes (optional)',
        description: 'Approve this claim for settlement.',
        tone: 'primary',
      };
    case 'REJECTED':
      return {
        id: 'reject',
        kind: 'status',
        label: 'Reject',
        icon: 'cancel',
        target,
        remarks: 'required',
        remarksLabel: 'Reason for rejection',
        description: 'The claimant will see this reason in the claim history.',
        tone: 'danger',
      };
    case 'ON_HOLD':
      return {
        id: 'hold',
        kind: 'status',
        label: 'Request information',
        icon: 'help_outline',
        target,
        remarks: 'required',
        remarksLabel: 'What does the claimant need to provide?',
        description:
          'The claim waits for the claimant. Only their reply resumes the review; until then you can only close it.',
        tone: 'neutral',
      };
    case 'SETTLED':
      return {
        id: 'settle',
        kind: 'status',
        label: 'Mark as settled',
        icon: 'paid',
        target,
        remarks: 'optional',
        remarksLabel: 'Notes (optional)',
        description: 'Record that the approved amount has been paid.',
        tone: 'primary',
      };
    default:
      return {
        id: 'close',
        kind: 'status',
        label: 'Close claim',
        icon: 'lock',
        target: 'CLOSED',
        remarks: 'optional',
        remarksLabel: 'Notes (optional)',
        description: 'Closing is final: a closed claim cannot be reopened.',
        tone: 'danger',
      };
  }
}
