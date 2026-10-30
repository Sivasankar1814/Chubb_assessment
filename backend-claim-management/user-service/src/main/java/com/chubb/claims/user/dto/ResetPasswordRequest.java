package com.chubb.claims.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank String username,
        @Schema(description = "The email address the account was registered with") @NotBlank String email,
        @NotBlank @Size(min = 6, max = 72) String newPassword) {
}
