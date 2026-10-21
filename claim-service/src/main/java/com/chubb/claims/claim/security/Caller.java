package com.chubb.claims.claim.security;

import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;

/** Framework-free view of the authenticated user so services stay easy to unit test. */
public record Caller(String username, Set<String> roles) {

    public static Caller from(Authentication authentication) {
        Set<String> roles = authentication.getAuthorities().stream()
                .map(a -> a.getAuthority().replaceFirst("^ROLE_", ""))
                .collect(Collectors.toSet());
        return new Caller(authentication.getName(), roles);
    }

    public boolean isClaimant() {
        return roles.contains("CLAIMANT");
    }

    public boolean isManager() {
        return roles.contains("MANAGER");
    }
}
