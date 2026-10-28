package com.chubb.claims.claim.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
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
            "UNDER_REVIEW, ON_HOLD, true",
            "ON_HOLD, UNDER_REVIEW, true",
            "ON_HOLD, CLOSED, true",
            "ON_HOLD, APPROVED, false",
            "ON_HOLD, REJECTED, false",
            "ASSIGNED, ON_HOLD, false",
            "OPEN, ON_HOLD, false",
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
    void onlyAssignedUnderReviewAndOnHoldCountAsWorkInProgress() {
        for (ClaimStatus status : ClaimStatus.values()) {
            boolean expected = status == ClaimStatus.ASSIGNED || status == ClaimStatus.UNDER_REVIEW
                    || status == ClaimStatus.ON_HOLD;
            assertThat(status.isWorkInProgress()).isEqualTo(expected);
        }
    }

    @Test
    void thereAreEightStatusesAndTheHoldOneIsCalledOnHold() {
        assertThat(ClaimStatus.values()).extracting(Enum::name).containsExactly("OPEN", "ASSIGNED", "UNDER_REVIEW",
                "ON_HOLD", "APPROVED", "REJECTED", "SETTLED", "CLOSED");
        for (String oldName : List.of("AWAITING_INFO", "MORE_INFO_REQUIRED")) {   // earlier names, no alias kept
            assertThatThrownBy(() -> ClaimStatus.valueOf(oldName)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void everyStatusNameFitsTheTwentyCharacterStatusColumns() {   // Claim.status and ClaimHistory.from/toStatus
        for (ClaimStatus status : ClaimStatus.values()) {
            assertThat(status.name().length()).as(status.name()).isLessThanOrEqualTo(20);
        }
    }
}
