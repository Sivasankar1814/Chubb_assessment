package com.chubb.claims.claim.dto;

import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.common.model.Market;
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
        @Schema(description = "Optional for officers/managers: omit it to file in your own name, or give a claimant's id "
                + "to file for them; ignored for claimants")
        Long claimantId,
        @Schema(description = "Full name of the claimant; must match the claimant's profile (ignoring case)")
        @NotBlank @Size(max = 100) String claimantName,
        @Schema(description = "SG, HK, JP, TH, IN or ID: the market the claim is filed in. If the claimant's profile "
                + "has a market, it must match it")
        @NotNull Market market,
        @NotNull ClaimType claimType,
        @NotBlank @Size(max = 1000) String description,
        @NotNull @DecimalMin(value = "0.01", message = "must be greater than zero")
        @Digits(integer = 13, fraction = 2) BigDecimal claimAmount,
        @NotNull @PastOrPresent LocalDate incidentDate) {
}
