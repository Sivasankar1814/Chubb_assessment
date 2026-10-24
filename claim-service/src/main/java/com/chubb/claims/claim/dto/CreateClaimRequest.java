package com.chubb.claims.claim.dto;

import com.chubb.claims.claim.model.ClaimType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateClaimRequest(
        @Schema(description = "Required when officer/manager files on behalf of a claimant; ignored for claimants")
        Long claimantId,
        @NotNull ClaimType claimType,
        @NotBlank @Size(max = 1000) String description,
        @NotNull @DecimalMin(value = "0.01", message = "must be greater than zero")
        @Digits(integer = 13, fraction = 2) BigDecimal claimAmount,
        @NotNull @PastOrPresent LocalDate incidentDate) {
}
