package com.chubb.claims.claim.service;

import com.chubb.claims.claim.client.UserClient;
import com.chubb.claims.claim.client.UserClient.UserSummary;
import com.chubb.claims.claim.dto.AssignClaimRequest;
import com.chubb.claims.claim.dto.CreateClaimRequest;
import com.chubb.claims.claim.dto.UpdateStatusRequest;
import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.claim.repository.ClaimHistoryRepository;
import com.chubb.claims.claim.repository.ClaimRepository;
import com.chubb.claims.claim.security.Caller;
import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.common.model.Market;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ClaimService {

    private static final String OFFICER_ROLE = "OFFICER";
    private static final String CLAIMANT_ROLE = "CLAIMANT";

    private final ClaimRepository claims;
    private final ClaimHistoryRepository history;
    private final UserClient userClient;

    public ClaimService(ClaimRepository claims, ClaimHistoryRepository history, UserClient userClient) {
        this.claims = claims;
        this.history = history;
        this.userClient = userClient;
    }

    @Transactional
    public Claim create(CreateClaimRequest request, Caller caller) {
        UserSummary claimant = resolveClaimant(request.claimantId(), caller);
        // A claimant need not have a market: the claim's market is chosen when it is filed. One that does have a market
        // on the profile files in that market only.
        if (claimant.market() != null && request.market() != claimant.market()) {
            throw new BusinessRuleException("Market %s does not match the market of claimant %s (%s)"
                    .formatted(request.market(), claimant.fullName(), claimant.market()));
        }
        if (!claimant.fullName().trim().equalsIgnoreCase(request.claimantName().trim())) {
            throw new BusinessRuleException("Name '%s' does not match the name of claimant id %d"
                    .formatted(request.claimantName(), claimant.id()));
        }
        // store the profile's spelling, not whatever casing or spacing was typed
        Claim claim = claims.save(new Claim(claimant.id(), claimant.fullName(), request.market(),
                request.claimType(), request.description(), request.claimAmount(), request.incidentDate()));
        claim.assignClaimNumber();
        claim.assignPolicyNumber(policyNumberFor(claimant, request.market()));
        record(claim, Action.CREATED, null, ClaimStatus.OPEN, caller, "Claim submitted");
        return claim;
    }

    /**
     * The policy a claim is filed under, decided here and never taken from the request: the claimant's own policy number
     * when their profile has one, otherwise {@code POL-<market>-<user id>} (for example {@code POL-SG-0012}). The second
     * form is a generated reference, stable for a person and market; there are no policy records to look one up in. The
     * frontend shows a preview from the same rule ({@code shared/policy-number.ts}): change both together, and keep the
     * example table in {@code ClaimServiceTest} and {@code policy-number.spec.ts} identical.
     */
    static String policyNumberFor(UserSummary claimant, Market market) {
        if (StringUtils.hasText(claimant.policyNumber())) {
            return claimant.policyNumber();
        }
        return "POL-%s-%04d".formatted(market, claimant.id());
    }

    public Claim get(long id, Caller caller) {
        Claim claim = find(id);
        assertCanView(claim, caller);
        return claim;
    }

    public List<Claim> list(ClaimStatus status, Long claimantId, Long assignedOfficerId, Market market,
                            ClaimType claimType, Caller caller) {
        if (caller.isClaimant()) {
            return claims.search(status, ownClaimantId(caller), assignedOfficerId, market, claimType);
        }
        return claims.search(status, claimantId, assignedOfficerId, market, claimType);
    }

    public List<ClaimHistory> getHistory(long id, Caller caller) {
        assertCanView(find(id), caller);
        return history.findByClaim_IdOrderByChangedAtAscIdAsc(id);
    }

    @Transactional
    public Claim assign(long id, AssignClaimRequest request, Caller caller) {
        Claim claim = find(id);
        ClaimStatus current = claim.getStatus();
        if (current != ClaimStatus.OPEN && !current.isWorkInProgress()) {
            throw new BusinessRuleException("Claims in status " + current + " cannot be (re)assigned");
        }

        UserSummary officer = userClient.getById(request.officerId());
        if (!OFFICER_ROLE.equals(officer.role())) {
            throw new BusinessRuleException("User " + officer.fullName() + " is not an officer");
        }
        if (!officer.active()) {
            throw new BusinessRuleException("Officer " + officer.fullName() + " is not active");
        }
        if (Objects.equals(claim.getAssignedOfficerId(), officer.id())) {
            throw new BusinessRuleException("Claim is already assigned to " + officer.fullName());
        }
        long openClaims = claims.countOpenByOfficer(officer.id());
        if (openClaims >= officer.maxCapacity()) {
            throw new BusinessRuleException("Officer %s is at full capacity (%d/%d open claims)"
                    .formatted(officer.fullName(), openClaims, officer.maxCapacity()));
        }

        boolean reassignment = claim.getAssignedOfficerId() != null;
        ClaimStatus newStatus = current == ClaimStatus.OPEN ? ClaimStatus.ASSIGNED : current;
        claim.assignTo(officer.id(), newStatus);
        String remarks = StringUtils.hasText(request.remarks()) ? request.remarks()
                : "Assigned to " + officer.fullName() + " (officer id " + officer.id() + ")";
        record(claim, reassignment ? Action.REASSIGNED : Action.ASSIGNED, current, newStatus, caller, remarks);
        return claims.save(claim);
    }

    @Transactional
    public StatusChange updateStatus(long id, UpdateStatusRequest request, Caller caller) {
        Claim claim = find(id);
        if (caller.isClaimant()) {
            return answerInformationRequest(claim, request, caller);
        }
        ClaimStatus before = claim.getStatus();   // read first: an officer's pick-up below can move OPEN to ASSIGNED
        if (!caller.isManager()) {
            claimForOfficer(claim, caller);
        }

        ClaimStatus current = claim.getStatus();
        ClaimStatus target = request.status();
        if (target == ClaimStatus.ASSIGNED) {
            throw new BusinessRuleException("Use the assignment endpoint to assign a claim to an officer");
        }
        if (current == ClaimStatus.ON_HOLD && target != ClaimStatus.CLOSED) {
            throw new BusinessRuleException("Claim is on hold: waiting for the claimant to provide the requested "
                    + "information. It continues when they submit it; staff can only close it");
        }
        if (!current.canTransitionTo(target)) {
            throw new BusinessRuleException("Cannot move claim from %s to %s. Allowed next statuses: %s"
                    .formatted(current, target, current.allowedTransitions()));
        }
        if (target == ClaimStatus.REJECTED && !StringUtils.hasText(request.remarks())) {
            throw new BusinessRuleException("Remarks are mandatory when rejecting a claim");
        }

        if (target == ClaimStatus.ON_HOLD && !StringUtils.hasText(request.remarks())) {
            throw new BusinessRuleException("Remarks are mandatory when requesting information: say what the "
                    + "claimant must provide");
        }

        boolean requestingInfo = target == ClaimStatus.ON_HOLD;
        if (requestingInfo) {
            claim.requestInformation(request.remarks(), caller.username());
        } else {
            claim.changeStatus(target);
        }
        ClaimHistory entry = record(claim, requestingInfo ? Action.INFO_REQUESTED : Action.STATUS_CHANGED, current,
                target, caller, request.remarks());
        return new StatusChange(claims.save(claim), before, entry);
    }

    /**
     * The only status change a claimant may make: answering an information request on their own claim. They send
     * {@code UNDER_REVIEW} with the reply as remarks and the claim goes straight back under review.
     */
    private StatusChange answerInformationRequest(Claim claim, UpdateStatusRequest request, Caller caller) {
        assertCanView(claim, caller);

        ClaimStatus current = claim.getStatus();
        ClaimStatus resumed = ClaimStatus.UNDER_REVIEW;
        if (request.status() != resumed) {
            throw new AccessDeniedException("Claimants can only answer an information request (status "
                    + resumed + ")");
        }
        if (current != ClaimStatus.ON_HOLD) {
            throw new BusinessRuleException("No information has been requested for this claim (its status is %s)"
                    .formatted(current));
        }
        if (!current.canTransitionTo(resumed)) {   // keeps ClaimStatus the one definition of the workflow
            throw new BusinessRuleException("Cannot move claim from %s to %s".formatted(current, resumed));
        }
        if (!StringUtils.hasText(request.remarks())) {
            throw new BusinessRuleException("Remarks are mandatory when answering an information request: write "
                    + "what you are providing");
        }

        claim.receiveInformation(request.remarks(), caller.username());
        ClaimHistory entry = record(claim, Action.INFO_PROVIDED, current, resumed, caller, request.remarks());
        return new StatusChange(claims.save(claim), current, entry);
    }

    /** officerId -> open (assigned / under review) claim count; consumed by the workload service. */
    public Map<Long, Long> openClaimCountsByOfficer() {
        return claims.countOpenGroupedByOfficer();
    }

    private Claim find(long id) {
        return claims.findById(id).orElseThrow(() -> new ResourceNotFoundException("Claim", id));
    }

    private UserSummary resolveClaimant(Long requestedId, Caller caller) {
        // A claimant files for themselves. So does an officer or manager who names nobody: the claim is then in their
        // own name. Naming a claimant files on that claimant's behalf (below).
        if (caller.isClaimant() || requestedId == null) {
            return userClient.getByUsername(caller.username());
        }
        UserSummary claimant = userClient.getById(requestedId);
        if (!CLAIMANT_ROLE.equals(claimant.role())) {
            throw new BusinessRuleException("User " + claimant.fullName() + " is not a claimant");
        }
        return claimant;
    }

    private Long ownClaimantId(Caller caller) {
        return userClient.getByUsername(caller.username()).id();
    }

    private void assertCanView(Claim claim, Caller caller) {
        if (caller.isClaimant() && !Objects.equals(claim.getClaimantId(), ownClaimantId(caller))) {
            throw new AccessDeniedException("Claimants can only access their own claims");
        }
    }

    /**
     * Officers may work a claim assigned to them, or pick up one nobody has been assigned to yet (the claim is then
     * assigned to them, subject to capacity). A claim assigned to someone else is off limits, and so is one that no
     * longer is {@code OPEN} yet has no officer: a manager is handling it directly, and it stays theirs to finish
     * unless they assign it to an officer.
     */
    private void claimForOfficer(Claim claim, Caller caller) {
        UserSummary me = userClient.getByUsername(caller.username());
        Long assignee = claim.getAssignedOfficerId();
        if (assignee != null) {
            if (!Objects.equals(assignee, me.id())) {
                throw new AccessDeniedException("Claim is not assigned to you");
            }
            return;
        }
        if (claim.getStatus() != ClaimStatus.OPEN) {
            throw new AccessDeniedException("Claim is not assigned to you");
        }
        long openClaims = claims.countOpenByOfficer(me.id());
        if (openClaims >= me.maxCapacity()) {
            throw new BusinessRuleException("Officer %s is at full capacity (%d/%d open claims)"
                    .formatted(me.fullName(), openClaims, me.maxCapacity()));
        }
        claim.assignTo(me.id(), ClaimStatus.ASSIGNED);
        record(claim, Action.ASSIGNED, ClaimStatus.OPEN, ClaimStatus.ASSIGNED, caller,
                "Picked up by " + me.fullName() + " (officer id " + me.id() + ")");
    }

    private ClaimHistory record(Claim claim, Action action, ClaimStatus from, ClaimStatus to, Caller caller,
                                String remarks) {
        ClaimHistory entry = new ClaimHistory(claim, action, from, to, caller.username(), remarks);
        history.save(entry);   // persist() stamps changedAt on this same instance
        return entry;
    }
}
