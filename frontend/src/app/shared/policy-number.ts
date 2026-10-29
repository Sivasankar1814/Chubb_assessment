import { Market } from '../models/enums';

/** What the policy number is worked out from: the profile of whoever the claim is for. */
export interface PolicyOwner {
  id: number;
  policyNumber?: string | null;
}

/**
 * The policy number a claim will be filed under, so the form can show it before anything is sent. It mirrors
 * `ClaimService.policyNumberFor` in claim-service, which is the authority: the server works the number out again and
 * stores its own, and the claim page shows that one. The claimant's own number when their profile has one, otherwise
 * `POL-<market>-<user id, at least 4 digits>`; nothing while that needs a market that is not chosen yet.
 *
 * Change both together, and keep the examples in `policy-number.spec.ts` and `ClaimServiceTest` identical.
 */
export function policyNumberFor(
  owner: PolicyOwner | null | undefined,
  market: Market | null | undefined,
): string {
  if (!owner) {
    return '';
  }
  if (owner.policyNumber?.trim()) {
    return owner.policyNumber;
  }
  return market ? `POL-${market}-${String(owner.id).padStart(4, '0')}` : '';
}
