package com.chubb.claims.user.dto;

import com.chubb.claims.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Sign-up without signing in. It is {@link CreateUserRequest} without the fields only staff set: the account is always
 * active, and an officer gets the default capacity. The role is the visitor's choice, any of the three.
 */
public record RegisterRequest(
        @NotBlank @Size(max = 50) String username,
        @NotBlank @Size(min = 6, max = 72) String password,
        @NotNull Role role,
        @NotBlank @Size(max = 100) String fullName,
        @NotBlank @Email @Size(max = 120) String email,
        @Pattern(regexp = "^\\+?[0-9\\- ]{7,20}$", message = "must be a valid phone number") String phone) {
}
