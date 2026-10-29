package com.chubb.claims.claim.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.claim.repository.ClaimHistoryRepository;
import com.chubb.claims.claim.repository.ClaimRepository;
import com.chubb.claims.common.model.Market;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

@DataJpaTest
@Import(DemoClaimSeeder.class)
class DemoClaimSeederTest {

    // user id -> market and full name, as seeded by user-service's DemoDataSeeder
    private static final Map<Long, Market> DEMO_CLAIMANTS = Map.of(
            1L, Market.JP, 2L, Market.SG, 6L, Market.HK, 7L, Market.TH, 8L, Market.IN, 9L, Market.ID);
    private static final Map<Long, String> DEMO_NAMES = Map.of(
            1L, "Aiko Tanaka", 2L, "Wei Lim", 6L, "Mei Chen", 7L, "Somchai Prasert", 8L, "Arjun Mehta",
            9L, "Budi Santoso");

    private static final Map<Long, String> DEMO_USERNAMES = Map.of(
            1L, "claimant1", 2L, "claimant2", 6L, "claimant3", 7L, "claimant4", 8L, "claimant5", 9L, "claimant6");

    @Autowired
    private DemoClaimSeeder seeder;
    @Autowired
    private ClaimRepository claims;
    @Autowired
    private ClaimHistoryRepository history;

    @BeforeEach
    void seed() {
        seeder.run(null);
    }

    @Test
    void everyMarketHasAMotorAndAPropertyClaim() {
        for (Market market : Market.values()) {
            for (ClaimType type : List.of(ClaimType.MOTOR, ClaimType.PROPERTY)) {
                assertThat(claims.search(null, null, null, market, type)).as("%s %s", market, type).hasSize(1);
            }
        }
        assertThat(claims.count()).isEqualTo(14);
    }

    @Test
    void eachClaimCarriesItsClaimantsNameMarketAndAClaimNumber() {
        for (Claim claim : claims.findAll()) {
            assertThat(DEMO_CLAIMANTS).containsEntry(claim.getClaimantId(), claim.getMarket());
            assertThat(DEMO_NAMES).containsEntry(claim.getClaimantId(), claim.getClaimantName());
            assertThat(claim.getClaimNumber()).matches("CLM-\\d{4}-\\d{6}");
        }
    }

    @Test
    void eachClaimCarriesItsClaimantsPolicyNumberInTheirMarket() {
        for (Claim claim : claims.findAll()) {
            // the seeded users' own numbers look like POL-JP-0001: the claim's market, then a running number
            assertThat(claim.getPolicyNumber()).isNotBlank()
                    .startsWith("POL-" + claim.getMarket() + "-").matches("POL-[A-Z]{2}-\\d{4}");
        }
    }

    @Test
    void everyHistoryChainIsALegalWorkflowPathEndingAtTheClaimsStatus() {
        for (Claim claim : claims.findAll()) {
            List<ClaimHistory> entries = history.findByClaim_IdOrderByChangedAtAscIdAsc(claim.getId());

            assertThat(entries.get(0).getAction()).isEqualTo(Action.CREATED);
            assertThat(entries.get(0).getToStatus()).isEqualTo(ClaimStatus.OPEN);
            for (int i = 1; i < entries.size(); i++) {
                ClaimHistory step = entries.get(i);
                assertThat(step.getFromStatus()).isEqualTo(entries.get(i - 1).getToStatus());
                assertThat(step.getFromStatus().canTransitionTo(step.getToStatus())).isTrue();
            }
            assertThat(entries.get(entries.size() - 1).getToStatus()).isEqualTo(claim.getStatus());
        }
    }

    @Test
    void oneClaimIsOnHoldWithAnOpenRequest() {
        List<Claim> waiting = claims.search(ClaimStatus.ON_HOLD, null, null, null, null);

        assertThat(waiting).hasSize(1);
        assertThat(waiting.get(0).getInfoRequest().message()).isNotBlank();
        assertThat(waiting.get(0).getInfoRequest().requestedBy()).startsWith("officer");
        assertThat(waiting.get(0).getLastReply()).isNull();
    }

    @Test
    void anAnsweredRequestShowsRequestThenReplyInTheHistory() {
        List<Claim> answered = claims.findAll().stream().filter(claim -> claim.getLastReply() != null).toList();

        assertThat(answered).hasSize(1);
        Claim claim = answered.get(0);
        assertThat(claim.getInfoRequest()).isNull();                        // answered, so no longer open
        assertThat(claim.getLastReply().message()).isNotBlank();
        List<ClaimHistory> entries = history.findByClaim_IdOrderByChangedAtAscIdAsc(claim.getId());
        assertThat(entries).extracting(ClaimHistory::getAction)
                .containsSubsequence(Action.INFO_REQUESTED, Action.INFO_PROVIDED);
        assertThat(entries).filteredOn(entry -> entry.getAction() == Action.INFO_PROVIDED)
                .extracting(ClaimHistory::getChangedBy).containsExactly(DEMO_USERNAMES.get(claim.getClaimantId()));
    }

    @Test
    void rejectedClaimsCarryRemarks() {
        List<Claim> rejected = claims.search(ClaimStatus.REJECTED, null, null, null, null);

        assertThat(rejected).isNotEmpty();
        for (Claim claim : rejected) {
            assertThat(history.findByClaim_IdOrderByChangedAtAscIdAsc(claim.getId()))
                    .last().extracting(ClaimHistory::getRemarks).asString().isNotBlank();
        }
    }

    @Test
    void officersStayWithinCapacity() {
        // capacities from DemoDataSeeder: officer1 (id 3) = 5, officer2 (id 4) = 8
        assertThat(claims.countOpenByOfficer(3)).isPositive().isLessThanOrEqualTo(5);
        assertThat(claims.countOpenByOfficer(4)).isPositive().isLessThanOrEqualTo(8);
    }

    @Test
    void runningAgainAddsNothing() {
        long before = claims.count();
        long historyBefore = history.count();

        seeder.run(null);

        assertThat(claims.count()).isEqualTo(before);
        assertThat(history.count()).isEqualTo(historyBefore);
    }
}
