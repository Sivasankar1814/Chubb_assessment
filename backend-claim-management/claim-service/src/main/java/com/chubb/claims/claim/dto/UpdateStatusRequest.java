package com.chubb.claims.claim.dto;

import com.chubb.claims.claim.model.ClaimStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateStatusRequest(@NotNull ClaimStatus status, @Size(max = 500) String remarks) {
}
