package com.chubb.claims.claim.model;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** Claim lifecycle. {@link #canTransitionTo} encodes the only legal moves between states. */
public enum ClaimStatus {
    OPEN, ASSIGNED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, SETTLED, CLOSED;

    /**
     * Statuses in which a claim counts towards an officer's workload. A claim waiting for the claimant still counts:
     * the officer owns it and gets it back as soon as the claimant replies.
     */
    public static final Set<ClaimStatus> IN_PROGRESS = EnumSet.of(ASSIGNED, UNDER_REVIEW, ON_HOLD);

    private static final Map<ClaimStatus, Set<ClaimStatus>> TRANSITIONS = new EnumMap<>(ClaimStatus.class);

    static {
        // OPEN to UNDER_REVIEW is a manager's move: a manager may review a claim themselves, with no officer assigned.
        // An officer never makes it, because picking a claim up assigns it to them first (ClaimService.claimForOfficer),
        // so their move starts from ASSIGNED.
        TRANSITIONS.put(OPEN, Set.of(ASSIGNED, UNDER_REVIEW, CLOSED));
        TRANSITIONS.put(ASSIGNED, Set.of(UNDER_REVIEW, CLOSED));
        TRANSITIONS.put(UNDER_REVIEW, Set.of(APPROVED, REJECTED, ON_HOLD));
        TRANSITIONS.put(ON_HOLD, Set.of(UNDER_REVIEW, CLOSED));
        TRANSITIONS.put(APPROVED, Set.of(SETTLED));
        TRANSITIONS.put(REJECTED, Set.of(CLOSED));
        TRANSITIONS.put(SETTLED, Set.of(CLOSED));
        TRANSITIONS.put(CLOSED, Set.of());
    }

    public boolean canTransitionTo(ClaimStatus target) {
        return TRANSITIONS.get(this).contains(target);
    }

    public Set<ClaimStatus> allowedTransitions() {
        return TRANSITIONS.get(this);
    }

    public boolean isWorkInProgress() {
        return IN_PROGRESS.contains(this);
    }
}
