package com.chubb.claims.claim.service;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.model.ClaimStatus;

/**
 * Outcome of a status update. {@code previousStatus} is the status the claim had before the request, so when an
 * officer's update also picks up an {@code OPEN} claim it is {@code OPEN}, while {@code entry} is the final
 * {@code STATUS_CHANGED} history row (whose own from-status is then {@code ASSIGNED}).
 */
public record StatusChange(Claim claim, ClaimStatus previousStatus, ClaimHistory entry) {
}
