package com.chubb.claims.claim.model;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** Claim lifecycle. {@link #canTransitionTo} encodes the only legal moves between states. */
public enum ClaimStatus {
    OPEN, ASSIGNED, UNDER_REVIEW, APPROVED, REJECTED, SETTLED, CLOSED;

    /** Statuses in which a claim counts towards a staff member's workload. */
    public static final Set<ClaimStatus> IN_PROGRESS = EnumSet.of(ASSIGNED, UNDER_REVIEW);

    private static final Map<ClaimStatus, Set<ClaimStatus>> TRANSITIONS = new EnumMap<>(ClaimStatus.class);

    static {
        TRANSITIONS.put(OPEN, Set.of(ASSIGNED, CLOSED));
        TRANSITIONS.put(ASSIGNED, Set.of(UNDER_REVIEW, CLOSED));
        TRANSITIONS.put(UNDER_REVIEW, Set.of(APPROVED, REJECTED));
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
