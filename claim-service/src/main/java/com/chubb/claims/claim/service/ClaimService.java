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
import com.chubb.claims.claim.repository.ClaimHistoryRepository;
import com.chubb.claims.claim.repository.ClaimRepository;
import com.chubb.claims.claim.security.Caller;
import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
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
        Long claimantId = resolveClaimantId(request.claimantId(), caller);
        Claim claim = claims.save(new Claim(claimantId, request.claimType(), request.description(),
                request.claimAmount(), request.incidentDate()));
        claim.assignClaimNumber();
        record(claim, Action.CREATED, null, ClaimStatus.OPEN, caller, "Claim submitted");
        return claim;
    }

    public Claim get(long id, Caller caller) {
        Claim claim = find(id);
        assertCanView(claim, caller);
        return claim;
    }

    public List<Claim> list(ClaimStatus status, Long claimantId, Long assignedOfficerId, Caller caller) {
        if (caller.isClaimant()) {
            return claims.search(status, ownClaimantId(caller), assignedOfficerId);
        }
        return claims.search(status, claimantId, assignedOfficerId);
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
    public Claim updateStatus(long id, UpdateStatusRequest request, Caller caller) {
        Claim claim = find(id);
        if (!caller.isManager()) {
            claimForOfficer(claim, caller);
        }

        ClaimStatus current = claim.getStatus();
        ClaimStatus target = request.status();
        if (target == ClaimStatus.ASSIGNED) {
            throw new BusinessRuleException("Use the assignment endpoint to assign a claim to an officer");
        }
        if (!current.canTransitionTo(target)) {
            throw new BusinessRuleException("Cannot move claim from %s to %s. Allowed next statuses: %s"
                    .formatted(current, target, current.allowedTransitions()));
        }
        if (target == ClaimStatus.REJECTED && !StringUtils.hasText(request.remarks())) {
            throw new BusinessRuleException("Remarks are mandatory when rejecting a claim");
        }

        claim.changeStatus(target);
        record(claim, Action.STATUS_CHANGED, current, target, caller, request.remarks());
        return claims.save(claim);
    }

    /** officerId -> open (assigned / under review) claim count; consumed by the workload service. */
    public Map<Long, Long> openClaimCountsByOfficer() {
        return claims.countOpenGroupedByOfficer();
    }

    private Claim find(long id) {
        return claims.findById(id).orElseThrow(() -> new ResourceNotFoundException("Claim", id));
    }

    private Long resolveClaimantId(Long requestedId, Caller caller) {
        if (caller.isClaimant()) {
            return ownClaimantId(caller);
        }
        if (requestedId == null) {
            throw new BusinessRuleException("claimantId is required when filing a claim on behalf of a claimant");
        }
        UserSummary claimant = userClient.getById(requestedId);
        if (!CLAIMANT_ROLE.equals(claimant.role())) {
            throw new BusinessRuleException("User " + claimant.fullName() + " is not a claimant");
        }
        return claimant.id();
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
     * assigned to them, subject to capacity). A claim assigned to someone else is off limits.
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
            return;
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

    private void record(Claim claim, Action action, ClaimStatus from, ClaimStatus to, Caller caller,
                        String remarks) {
        history.save(new ClaimHistory(claim, action, from, to, caller.username(), remarks));
    }
}
