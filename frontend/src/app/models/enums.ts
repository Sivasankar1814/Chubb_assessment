// Mirrors the backend enums: ClaimStatus, ClaimType, Market (common), Role, ClaimHistory.Action, Level.

export const ROLES = ['CLAIMANT', 'OFFICER', 'MANAGER'] as const;
export type Role = (typeof ROLES)[number];

export const MARKETS = ['SG', 'HK', 'JP', 'TH', 'IN', 'ID'] as const;
export type Market = (typeof MARKETS)[number];

export const MARKET_NAMES: Record<Market, string> = {
  SG: 'Singapore',
  HK: 'Hong Kong',
  JP: 'Japan',
  TH: 'Thailand',
  IN: 'India',
  ID: 'Indonesia',
};

export const CLAIM_TYPES = ['HEALTH', 'MOTOR', 'PROPERTY', 'TRAVEL', 'LIABILITY'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'UNDER_REVIEW',
  'ON_HOLD',
  'APPROVED',
  'REJECTED',
  'SETTLED',
  'CLOSED',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type HistoryAction =
  'CREATED' | 'ASSIGNED' | 'REASSIGNED' | 'STATUS_CHANGED' | 'INFO_REQUESTED' | 'INFO_PROVIDED';

export type WorkloadLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'FULL';

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
