package com.chubb.claims.claim.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class ClaimRepositoryTest {

    @Autowired
    private ClaimRepository claims;
    @Autowired
    private ClaimHistoryRepository history;

    private Claim newClaim(long claimantId, ClaimStatus status, Long staffId) {
        Claim claim = new Claim(claimantId, ClaimType.MOTOR, "Water damage", new BigDecimal("2500.50"),
                LocalDate.now().minusDays(1));
        if (staffId != null) {
            claim.assignTo(staffId, status);
        } else {
            claim.changeStatus(status);
        }
        return claims.saveAndFlush(claim);
    }

    @Test
    void saveStampsAuditColumnsAndClaimNumberCanBeDerivedFromId() {
        Claim saved = newClaim(1, ClaimStatus.OPEN, null);
        saved.assignClaimNumber();
        claims.flush();

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getClaimNumber())
                .isEqualTo("CLM-%d-%06d".formatted(LocalDate.now().getYear(), saved.getId()));
        assertThat(saved.getClaimAmount()).isEqualByComparingTo("2500.50");
        assertThat(saved.getAssignedStaffId()).isNull();
    }

    @Test
    void searchAppliesFilters() {
        newClaim(1, ClaimStatus.OPEN, null);
        newClaim(2, ClaimStatus.ASSIGNED, 7L);

        assertThat(claims.search(null, null, null)).hasSize(2);
        assertThat(claims.search(ClaimStatus.ASSIGNED, null, null)).hasSize(1);
        assertThat(claims.search(null, 1L, null)).hasSize(1);
        assertThat(claims.search(null, null, 7L)).extracting(Claim::getClaimantId).containsExactly(2L);
    }

    @Test
    void openCountsOnlyIncludeAssignedAndUnderReview() {
        newClaim(1, ClaimStatus.ASSIGNED, 7L);
        newClaim(1, ClaimStatus.UNDER_REVIEW, 7L);
        newClaim(1, ClaimStatus.APPROVED, 7L);
        newClaim(1, ClaimStatus.ASSIGNED, 8L);

        assertThat(claims.countOpenByStaff(7)).isEqualTo(2);
        assertThat(claims.countOpenGroupedByStaff()).isEqualTo(Map.of(7L, 2L, 8L, 1L));
    }

    @Test
    void historyIsReturnedInChronologicalOrder() {
        Claim saved = newClaim(1, ClaimStatus.OPEN, null);
        history.save(new ClaimHistory(saved, Action.CREATED, null, ClaimStatus.OPEN, "u", "r1"));
        history.saveAndFlush(new ClaimHistory(saved, Action.ASSIGNED, ClaimStatus.OPEN, ClaimStatus.ASSIGNED,
                "m", "r2"));

        List<ClaimHistory> entries = history.findByClaim_IdOrderByChangedAtAscIdAsc(saved.getId());

        assertThat(entries).extracting(ClaimHistory::getAction).containsExactly(Action.CREATED, Action.ASSIGNED);
        assertThat(entries.get(0).getFromStatus()).isNull();
        assertThat(entries.get(0).getClaimId()).isEqualTo(saved.getId());
    }
}
