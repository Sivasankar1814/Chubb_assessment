package com.chubb.claims.claim.dto;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.common.model.Market;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Result of {@code PATCH /api/claims/{id}/status}: every field of the updated claim at the top level, exactly as
 * {@code GET /api/claims/{id}} shows it, plus what this update did. The claim fields are spelled out (not
 * {@code @JsonUnwrapped}) so the OpenAPI schema lists them; {@code StatusUpdateResponseTest} fails when {@link Claim}
 * gains a field that is missing here.
 */
public record StatusUpdateResponse(
        Long id,
        String claimNumber,
        Long claimantId,
        String claimantName,
        Market market,
        String policyNumber,
        ClaimType claimType,
        String description,
        BigDecimal claimAmount,
        LocalDate incidentDate,
        ClaimStatus status,
        Long assignedOfficerId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Claim.InfoRequest infoRequest,
        Claim.InfoReply lastReply,
        ClaimStatus previousStatus,
        String remarks,
        String changedBy,
        LocalDateTime changedAt) {

    public static StatusUpdateResponse from(Claim c, ClaimStatus previousStatus, ClaimHistory entry) {
        return new StatusUpdateResponse(c.getId(), c.getClaimNumber(), c.getClaimantId(), c.getClaimantName(),
                c.getMarket(), c.getPolicyNumber(), c.getClaimType(), c.getDescription(), c.getClaimAmount(),
                c.getIncidentDate(),
                c.getStatus(), c.getAssignedOfficerId(), c.getCreatedAt(), c.getUpdatedAt(),
                c.getInfoRequest(), c.getLastReply(), previousStatus, entry.getRemarks(), entry.getChangedBy(), entry.getChangedAt());
    }
}
