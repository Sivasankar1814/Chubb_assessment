package com.chubb.claims.claim.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.common.model.Market;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.util.ReflectionTestUtils;

@DataJpaTest
class ClaimRepositoryTest {

    @Autowired
    private ClaimRepository claims;
    @Autowired
    private ClaimHistoryRepository history;
    @Autowired
    private EntityManager entityManager;

    private Claim newClaim(long claimantId, ClaimStatus status, Long officerId) {
        return newClaim(claimantId, Market.SG, ClaimType.MOTOR, status, officerId);
    }

    private Claim newClaim(long claimantId, Market market, ClaimType type, ClaimStatus status, Long officerId) {
        Claim claim = new Claim(claimantId, "Claimant " + claimantId, market, type, "Water damage",
                new BigDecimal("2500.50"), LocalDate.now().minusDays(1));
        if (officerId != null) {
            claim.assignTo(officerId, status);
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
        assertThat(saved.getAssignedOfficerId()).isNull();
    }

    @Test
    void searchAppliesFilters() {
        newClaim(1, ClaimStatus.OPEN, null);
        newClaim(2, ClaimStatus.ASSIGNED, 7L);

        assertThat(claims.search(null, null, null, null, null)).hasSize(2);
        assertThat(claims.search(ClaimStatus.ASSIGNED, null, null, null, null)).hasSize(1);
        assertThat(claims.search(null, 1L, null, null, null)).hasSize(1);
        assertThat(claims.search(null, null, 7L, null, null)).extracting(Claim::getClaimantId).containsExactly(2L);
    }

    @Test
    void searchFiltersByMarketAndClaimTypeAcrossMarkets() {
        newClaim(1, Market.SG, ClaimType.MOTOR, ClaimStatus.OPEN, null);
        newClaim(2, Market.SG, ClaimType.PROPERTY, ClaimStatus.OPEN, null);
        newClaim(3, Market.JP, ClaimType.MOTOR, ClaimStatus.OPEN, null);
        newClaim(4, Market.TH, ClaimType.PROPERTY, ClaimStatus.OPEN, null);
        newClaim(5, Market.HK, ClaimType.HEALTH, ClaimStatus.OPEN, null);

        assertThat(claims.search(null, null, null, Market.SG, null)).extracting(Claim::getClaimantId)
                .containsExactly(2L, 1L);                                        // newest first
        assertThat(claims.search(null, null, null, null, ClaimType.PROPERTY)).extracting(Claim::getMarket)
                .containsExactly(Market.TH, Market.SG);
        assertThat(claims.search(null, null, null, Market.JP, ClaimType.MOTOR)).extracting(Claim::getClaimantId)
                .containsExactly(3L);
        assertThat(claims.search(null, null, null, Market.JP, ClaimType.PROPERTY)).isEmpty();
        assertThat(claims.search(null, null, null, Market.ID, null)).isEmpty();
    }

    @Test
    void marketAndClaimantNameArePersistedOnTheClaim() {
        Claim saved = newClaim(1, Market.IN, ClaimType.PROPERTY, ClaimStatus.OPEN, null);
        entityManager.clear();

        Claim reloaded = claims.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getMarket()).isEqualTo(Market.IN);
        assertThat(reloaded.getClaimantName()).isEqualTo("Claimant 1");
    }

    @Test
    void openCountsIncludeAssignedUnderReviewAndOnHoldOnly() {
        newClaim(1, ClaimStatus.ASSIGNED, 7L);
        newClaim(1, ClaimStatus.UNDER_REVIEW, 7L);
        newClaim(1, ClaimStatus.ON_HOLD, 7L);   // the officer still owns it while the claimant answers
        newClaim(1, ClaimStatus.APPROVED, 7L);
        newClaim(1, ClaimStatus.SETTLED, 7L);
        newClaim(1, ClaimStatus.ASSIGNED, 8L);

        assertThat(claims.countOpenByOfficer(7)).isEqualTo(3);
        assertThat(claims.countOpenGroupedByOfficer()).isEqualTo(Map.of(7L, 3L, 8L, 1L));
    }

    @Test
    void informationRequestAndReplyArePersistedOnTheClaim() {
        Claim saved = newClaim(1, ClaimStatus.UNDER_REVIEW, 7L);
        saved.requestInformation("Please send the repair invoice", "officer1");
        claims.saveAndFlush(saved);
        entityManager.clear();

        Claim waiting = claims.findById(saved.getId()).orElseThrow();
        assertThat(waiting.getStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(waiting.getInfoRequest().message()).isEqualTo("Please send the repair invoice");
        assertThat(waiting.getInfoRequest().requestedBy()).isEqualTo("officer1");
        assertThat(waiting.getInfoRequest().requestedAt()).isNotNull();
        assertThat(waiting.getLastReply()).isNull();
        assertThat(claims.search(ClaimStatus.ON_HOLD, null, null, null, null)).hasSize(1);

        waiting.receiveInformation("Invoice INV-77 attached", "claimant1");
        claims.saveAndFlush(waiting);
        entityManager.clear();

        Claim answered = claims.findById(saved.getId()).orElseThrow();
        assertThat(answered.getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(answered.getInfoRequest()).isNull();                     // closed once answered
        assertThat(answered.getLastReply().message()).isEqualTo("Invoice INV-77 attached");
        assertThat(answered.getLastReply().repliedBy()).isEqualTo("claimant1");
        assertThat(answered.getLastReply().repliedAt()).isNotNull();
        assertThat(claims.search(ClaimStatus.ON_HOLD, null, null, null, null)).isEmpty();
    }

    @Test
    void historyEntriesComeWithTheirClaimLoadedSoMarketAndNameCanBeShown() {
        Claim saved = newClaim(3, Market.TH, ClaimType.MOTOR, ClaimStatus.OPEN, null);
        history.saveAndFlush(new ClaimHistory(saved, Action.CREATED, null, ClaimStatus.OPEN, "u", "r1"));
        entityManager.clear();   // forget the claim, so only the query itself can bring it back

        ClaimHistory entry = history.findByClaim_IdOrderByChangedAtAscIdAsc(saved.getId()).get(0);

        // the controller serialises after the session is gone, so a lazy proxy here would fail in production
        assertThat(Hibernate.isInitialized(ReflectionTestUtils.getField(entry, "claim"))).isTrue();
        assertThat(entry.getMarket()).isEqualTo(Market.TH);
        assertThat(entry.getClaimantName()).isEqualTo("Claimant 3");
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
