package com.chubb.claims.user.dto;

import com.chubb.claims.user.entity.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank @Size(max = 50) String username,
        @NotBlank @Size(min = 6, max = 72) String password,
        @NotNull Role role,
        @NotBlank @Size(max = 100) String fullName,
        @NotBlank @Email @Size(max = 120) String email,
        @Pattern(regexp = "^\\+?[0-9\\- ]{7,20}$", message = "must be a valid phone number") String phone,
        Boolean active,
        @Schema(description = "CLAIMANT only (required)") @Size(max = 50) String country,
        @Schema(description = "CLAIMANT only (required)") @Size(max = 30) String policyNumber,
        @Schema(description = "OFFICER only (required)") @Size(max = 30) String specialization,
        @Schema(description = "OFFICER only (required): most open claims this person can hold")
        @Min(1) @Max(100) Integer maxCapacity) {
}
