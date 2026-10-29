import { ClaimStatus, ClaimType, HistoryAction, Market } from './enums';

export interface InfoRequest {
  message: string;
  requestedBy: string;
  requestedAt: string;
}

export interface InfoReply {
  message: string;
  repliedBy: string;
  repliedAt: string;
}

/** GET /api/claims/{id}. Dates are timezone-less ISO strings; incidentDate is a plain yyyy-MM-dd. */
export interface Claim {
  id: number;
  claimNumber: string;
  claimantId: number;
  claimantName: string;
  market: Market;
  /** Decided by the server when the claim is filed; absent on claims filed before it existed. */
  policyNumber?: string | null;
  claimType: ClaimType;
  description: string;
  claimAmount: number;
  incidentDate: string;
  status: ClaimStatus;
  assignedOfficerId: number | null;
  infoRequest: InfoRequest | null;
  lastReply: InfoReply | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimHistoryEntry {
  id: number;
  claimId: number;
  claimantName: string;
  market: Market;
  action: HistoryAction;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  changedBy: string;
  remarks: string | null;
  changedAt: string;
}

export interface ClaimFilters {
  status?: ClaimStatus;
  claimantId?: number;
  assignedOfficerId?: number;
  market?: Market;
  claimType?: ClaimType;
}

export interface CreateClaimRequest {
  /** Required when staff file on behalf of a claimant; the backend ignores it for claimants. */
  claimantId?: number;
  claimantName: string;
  market: Market;
  claimType: ClaimType;
  description: string;
  claimAmount: number;
  /** yyyy-MM-dd */
  incidentDate: string;
}

export interface UpdateStatusRequest {
  status: ClaimStatus;
  remarks?: string;
}

export interface AssignClaimRequest {
  officerId: number;
  remarks?: string;
}

/** PATCH /api/claims/{id}/status: the updated claim plus what this change did. */
export interface StatusUpdateResponse extends Claim {
  previousStatus: ClaimStatus;
  remarks: string | null;
  changedBy: string;
  changedAt: string;
}
