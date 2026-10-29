package com.chubb.claims.claim.controller;

import com.chubb.claims.claim.dto.AssignClaimRequest;
import com.chubb.claims.claim.dto.CreateClaimRequest;
import com.chubb.claims.claim.dto.StatusUpdateResponse;
import com.chubb.claims.claim.dto.UpdateStatusRequest;
import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.claim.security.Caller;
import com.chubb.claims.claim.service.ClaimService;
import com.chubb.claims.claim.service.StatusChange;
import com.chubb.claims.common.model.Market;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/claims")
@Tag(name = "Claims", description = "Claim lifecycle: submission, assignment, status and history")
public class ClaimController {

    private final ClaimService service;

    public ClaimController(ClaimService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Submit a claim (claimants file for themselves; officers and managers file on behalf of a claimant)")
    public ResponseEntity<Claim> create(@Valid @RequestBody CreateClaimRequest request, Authentication auth) {
        Claim created = service.create(request, Caller.from(auth));
        return ResponseEntity.created(URI.create("/api/claims/" + created.getId())).body(created);
    }

    @GetMapping
    @Operation(summary = "List claims, optionally by status, claimant, officer, market (SG, HK, JP, TH, IN, ID) or "
            + "claim type (claimants only see their own)")
    public List<Claim> list(@RequestParam(required = false) ClaimStatus status,
                            @RequestParam(required = false) Long claimantId,
                            @RequestParam(required = false) Long assignedOfficerId,
                            @RequestParam(required = false) Market market,
                            @RequestParam(required = false) ClaimType claimType,
                            Authentication auth) {
        return service.list(status, claimantId, assignedOfficerId, market, claimType, Caller.from(auth));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a claim by id")
    public Claim get(@PathVariable long id, Authentication auth) {
        return service.get(id, Caller.from(auth));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Audit trail of every assignment and status change")
    public List<ClaimHistory> history(@PathVariable long id, Authentication auth) {
        return service.getHistory(id, Caller.from(auth));
    }

    @PutMapping("/{id}/assignment")
    @PreAuthorize("hasRole('MANAGER')")
    @Operation(summary = "Assign or reassign a claim to an officer (manager)")
    public Claim assign(@PathVariable long id, @Valid @RequestBody AssignClaimRequest request, Authentication auth) {
        return service.assign(id, request, Caller.from(auth));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('CLAIMANT','OFFICER','MANAGER')")
    @Operation(summary = "Move a claim to its next status (assigned officer or manager). ON_HOLD asks the "
            + "claimant for more information and needs remarks. The claimant answers it on their own claim with status "
            + "UNDER_REVIEW and the reply as remarks. Returns the claim plus previousStatus, remarks, changedBy and "
            + "changedAt")
    public StatusUpdateResponse updateStatus(@PathVariable long id, @Valid @RequestBody UpdateStatusRequest request,
                                             Authentication auth) {
        StatusChange change = service.updateStatus(id, request, Caller.from(auth));
        return StatusUpdateResponse.from(change.claim(), change.previousStatus(), change.entry());
    }

    @GetMapping("/stats/open-by-officer")
    @PreAuthorize("hasAnyRole('OFFICER','MANAGER')")
    @Operation(summary = "Open claim count per officer id (used by the workload service)")
    public Map<Long, Long> openByOfficer() {
        return service.openClaimCountsByOfficer();
    }
}
