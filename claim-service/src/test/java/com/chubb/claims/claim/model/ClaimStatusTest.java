package com.chubb.claims.claim.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ClaimStatusTest {

    @ParameterizedTest
    @CsvSource({
            "OPEN, ASSIGNED, true",
            "ASSIGNED, UNDER_REVIEW, true",
            "UNDER_REVIEW, APPROVED, true",
            "UNDER_REVIEW, REJECTED, true",
            "APPROVED, SETTLED, true",
            "SETTLED, CLOSED, true",
            "OPEN, APPROVED, false",
            "ASSIGNED, SETTLED, false",
            "REJECTED, APPROVED, false",
            "CLOSED, OPEN, false"
    })
    void transitionRules(ClaimStatus from, ClaimStatus to, boolean allowed) {
        assertThat(from.canTransitionTo(to)).isEqualTo(allowed);
    }

    @Test
    void closedIsTerminal() {
        assertThat(ClaimStatus.CLOSED.allowedTransitions()).isEmpty();
    }

    @Test
    void onlyAssignedAndUnderReviewCountAsWorkInProgress() {
        for (ClaimStatus status : ClaimStatus.values()) {
            boolean expected = status == ClaimStatus.ASSIGNED || status == ClaimStatus.UNDER_REVIEW;
            assertThat(status.isWorkInProgress()).isEqualTo(expected);
        }
    }
}
