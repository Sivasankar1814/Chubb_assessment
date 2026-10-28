package com.chubb.claims.user.dto;

import com.chubb.claims.common.model.Market;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;

/** Public view of a user: never exposes the password hash, and omits fields that do not apply to the role. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UserResponse(Long id, String username, Role role, String fullName, String email, String phone,
                           boolean active, Market market, String policyNumber, String specialization,
                           Integer maxCapacity, LocalDateTime createdAt) {

    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getUsername(), u.getRole(), u.getFullName(), u.getEmail(), u.getPhone(),
                u.isActive(), u.getMarket(), u.getPolicyNumber(), u.getSpecialization(), u.getMaxCapacity(),
                u.getCreatedAt());
    }
}
