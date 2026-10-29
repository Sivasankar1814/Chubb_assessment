package com.chubb.claims.claim.client;

import com.chubb.claims.common.model.Market;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service", url = "${services.user.url:http://localhost:8081}")
public interface UserClient {

    @GetMapping("/api/users/{id}")
    UserSummary getById(@PathVariable("id") Long id);

    @GetMapping("/api/users/by-username/{username}")
    UserSummary getByUsername(@PathVariable("username") String username);

    /**
     * The fields claim-service needs; maxCapacity is only present for officers, market and policyNumber only for
     * claimants that have them.
     */
    record UserSummary(Long id, String fullName, String role, boolean active, int maxCapacity, Market market,
                       String policyNumber) {
    }
}
