package com.chubb.claims.claim.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record AssignClaimRequest(@NotNull @Positive Long staffId, @Size(max = 500) String remarks) {
}
