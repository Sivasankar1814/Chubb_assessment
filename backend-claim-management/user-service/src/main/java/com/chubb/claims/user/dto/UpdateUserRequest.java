package com.chubb.claims.user.dto;

import com.chubb.claims.common.model.Market;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Username and role cannot be changed. The role decides which of the role-specific fields apply. */
public record UpdateUserRequest(
        @NotBlank @Size(max = 100) String fullName,
        @NotBlank @Email @Size(max = 120) String email,
        @Pattern(regexp = "^\\+?[0-9\\- ]{7,20}$", message = "must be a valid phone number") String phone,
        Boolean active,
        @Schema(description = "Leave empty to keep the current password") @Size(min = 6, max = 72) String password,
        Market market,
        @Size(max = 30) String policyNumber,
        @Size(max = 30) String specialization,
        @Schema(description = "OFFICER only: omitted means the default (5), not 'keep the current one'")
        @Min(1) @Max(100) Integer maxCapacity) {
}
