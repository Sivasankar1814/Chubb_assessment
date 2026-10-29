package com.chubb.claims.claim.config;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.claim.repository.ClaimHistoryRepository;
import com.chubb.claims.claim.repository.ClaimRepository;
import com.chubb.claims.common.model.Market;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates demo claims on first start, two per market (one MOTOR, one PROPERTY) plus a HEALTH and a TRAVEL claim.
 * One claim is waiting for the claimant's information and one has been answered.
 * Written straight to the repositories, not through {@code ClaimService}, because the service needs a caller and
 * calls user-service, which may not be up yet. The user ids, usernames and markets below follow user-service's
 * {@code DemoDataSeeder}, so turn this off wherever {@code chubb.seed-demo-users} is off. The names and markets must
 * match the seeded users.
 */
@Component
@ConditionalOnProperty(name = "chubb.seed-demo-claims", havingValue = "true", matchIfMissing = true)
public class DemoClaimSeeder implements ApplicationRunner {

    /** The policy numbers are the seeded users' own (user-service's DemoDataSeeder), as ClaimService would pick them. */
    private record Claimant(Long id, String username, String fullName, Market market, String policyNumber) {
    }

    private static final Claimant AIKO = new Claimant(1L, "claimant1", "Aiko Tanaka", Market.JP, "POL-JP-0001");
    private static final Claimant WEI = new Claimant(2L, "claimant2", "Wei Lim", Market.SG, "POL-SG-0002");
    private static final Claimant MEI = new Claimant(6L, "claimant3", "Mei Chen", Market.HK, "POL-HK-0003");
    private static final Claimant SOMCHAI = new Claimant(7L, "claimant4", "Somchai Prasert", Market.TH, "POL-TH-0004");
    private static final Claimant ARJUN = new Claimant(8L, "claimant5", "Arjun Mehta", Market.IN, "POL-IN-0005");
    private static final Claimant BUDI = new Claimant(9L, "claimant6", "Budi Santoso", Market.ID, "POL-ID-0006");

    private static final Long PRIYA = 3L;   // officer1
    private static final Long DANIEL = 4L;  // officer2
    private static final String MANAGER = "manager1";

    private final ClaimRepository claims;
    private final ClaimHistoryRepository history;

    public DemoClaimSeeder(ClaimRepository claims, ClaimHistoryRepository history) {
        this.claims = claims;
        this.history = history;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (claims.count() > 0) {
            return;
        }
        // Japan
        file(AIKO, ClaimType.MOTOR, "Rear-ended at a red light on the Metropolitan Expressway; bumper and boot damaged",
                "2400.00", 2);
        Claim typhoon = file(AIKO, ClaimType.PROPERTY, "Typhoon blew roof tiles off a detached house in Yokohama",
                "8600.00", 9);
        assign(typhoon, PRIYA);
        Claim physio = file(AIKO, ClaimType.HEALTH, "Outpatient physiotherapy after a skiing fall", "650.00", 30);
        move(physio, ClaimStatus.CLOSED, "Withdrawn by the claimant");

        // Singapore
        Claim carPark = file(WEI, ClaimType.MOTOR, "Side-swiped in an Orchard Road car park; driver door and mirror",
                "3100.00", 12);
        assign(carPark, DANIEL);
        move(carPark, ClaimStatus.UNDER_REVIEW, "Review started");
        requestInfo(carPark, "Please send the repair estimate and photos of the damage to the door and mirror");
        Claim pipe = file(WEI, ClaimType.PROPERTY, "Burst water pipe flooded the living room of a Tampines condominium",
                "5200.00", 20);
        assign(pipe, DANIEL);
        walk(pipe, ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED);
        file(WEI, ClaimType.TRAVEL, "Flight to Tokyo cancelled; non-refundable hotel nights", "1200.00", 1);

        // Hong Kong
        Claim windscreen = file(MEI, ClaimType.MOTOR, "Windscreen cracked by road debris on Tuen Mun Road", "900.00", 45);
        assign(windscreen, PRIYA);
        move(windscreen, ClaimStatus.UNDER_REVIEW, "Review started");
        requestInfo(windscreen, "Please send a photo of the cracked windscreen and the garage quote");
        reply(windscreen, MEI, "Photo and garage quote (HKD 3,200) uploaded to the claims portal");
        walk(windscreen, ClaimStatus.APPROVED, ClaimStatus.SETTLED);
        file(MEI, ClaimType.PROPERTY, "Leak from the flat above damaged the ceiling and wiring in Kowloon", "4300.00", 3);

        // Thailand
        Claim junction = file(SOMCHAI, ClaimType.MOTOR, "Collision with a motorbike at a Bangkok junction; front-left damage",
                "2750.00", 8);
        assign(junction, PRIYA);
        move(junction, ClaimStatus.UNDER_REVIEW, "Review started");
        Claim shed = file(SOMCHAI, ClaimType.PROPERTY, "Flood damage to a garden storage shed", "1800.00", 25);
        assign(shed, DANIEL);
        move(shed, ClaimStatus.UNDER_REVIEW, "Review started");
        move(shed, ClaimStatus.REJECTED, "Outbuildings are excluded under policy section 4.2");

        // India
        Claim pothole = file(ARJUN, ClaimType.MOTOR, "Pothole on the Mumbai-Pune Expressway; two tyres and a rim damaged",
                "1100.00", 5);
        assign(pothole, DANIEL);
        Claim kitchen = file(ARJUN, ClaimType.PROPERTY, "Kitchen fire in a Bengaluru apartment", "7400.00", 60);
        assign(kitchen, PRIYA);
        walk(kitchen, ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED, ClaimStatus.SETTLED, ClaimStatus.CLOSED);

        // Indonesia
        file(BUDI, ClaimType.MOTOR, "Parked car hit by a falling tree branch in Jakarta", "1950.00", 4);
        Claim quake = file(BUDI, ClaimType.PROPERTY, "Minor earthquake cracked the boundary wall and plaster in Bandung",
                "3600.00", 70);
        assign(quake, DANIEL);
        walk(quake, ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED, ClaimStatus.SETTLED, ClaimStatus.CLOSED);
    }

    private Claim file(Claimant claimant, ClaimType type, String description, String amount, int incidentDaysAgo) {
        Claim claim = claims.save(new Claim(claimant.id(), claimant.fullName(), claimant.market(), type, description,
                new BigDecimal(amount), LocalDate.now().minusDays(incidentDaysAgo)));
        claim.assignClaimNumber();
        claim.assignPolicyNumber(claimant.policyNumber());
        record(claim, Action.CREATED, null, ClaimStatus.OPEN, claimant.username(), "Claim submitted");
        return claim;
    }

    /** What the manager's assignment endpoint does: OPEN to ASSIGNED, history row included. */
    private void assign(Claim claim, Long officerId) {
        requireLegal(claim.getStatus(), ClaimStatus.ASSIGNED);
        claim.assignTo(officerId, ClaimStatus.ASSIGNED);
        record(claim, Action.ASSIGNED, ClaimStatus.OPEN, ClaimStatus.ASSIGNED, MANAGER,
                "Assigned to officer id " + officerId);
    }

    private void move(Claim claim, ClaimStatus to, String remarks) {
        ClaimStatus from = claim.getStatus();
        requireLegal(from, to);
        claim.changeStatus(to);
        record(claim, Action.STATUS_CHANGED, from, to, actor(claim), remarks);
    }

    /** The assigned officer asks the claimant for more information while reviewing. */
    private void requestInfo(Claim claim, String message) {
        ClaimStatus from = claim.getStatus();
        requireLegal(from, ClaimStatus.ON_HOLD);
        String officer = actor(claim);
        claim.requestInformation(message, officer);
        record(claim, Action.INFO_REQUESTED, from, ClaimStatus.ON_HOLD, officer, message);
    }

    /** The claimant answers, which puts the claim back under review. */
    private void reply(Claim claim, Claimant claimant, String message) {
        ClaimStatus from = claim.getStatus();
        if (from != ClaimStatus.ON_HOLD) {
            throw new IllegalStateException("Demo data replies to a claim that is " + from + ", not "
                    + ClaimStatus.ON_HOLD);
        }
        requireLegal(from, ClaimStatus.UNDER_REVIEW);
        claim.receiveInformation(message, claimant.username());
        record(claim, Action.INFO_PROVIDED, from, ClaimStatus.UNDER_REVIEW, claimant.username(), message);
    }

    private void walk(Claim claim, ClaimStatus... steps) {
        for (ClaimStatus step : steps) {
            move(claim, step, switch (step) {
                case UNDER_REVIEW -> "Review started";
                case APPROVED -> "Approved after review";
                case SETTLED -> "Payment released";
                case CLOSED -> "File closed";
                default -> throw new IllegalArgumentException("Give " + step + " explicit remarks via move()");
            });
        }
    }

    /** The assigned officer works the claim; the manager acts on claims nobody holds. */
    private String actor(Claim claim) {
        Long officerId = claim.getAssignedOfficerId();
        if (PRIYA.equals(officerId)) {
            return "officer1";
        }
        return DANIEL.equals(officerId) ? "officer2" : MANAGER;
    }

    private void requireLegal(ClaimStatus from, ClaimStatus to) {
        if (!from.canTransitionTo(to)) {
            throw new IllegalStateException("Demo data would move a claim from " + from + " to " + to);
        }
    }

    private void record(Claim claim, Action action, ClaimStatus from, ClaimStatus to, String by, String remarks) {
        history.save(new ClaimHistory(claim, action, from, to, by, remarks));
    }
}
