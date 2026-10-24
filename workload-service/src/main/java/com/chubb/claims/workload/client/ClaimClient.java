package com.chubb.claims.workload.client;

import java.util.Map;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "claim-service", url = "${services.claim.url:http://localhost:8083}")
public interface ClaimClient {

    /** officerId -> number of claims currently assigned / under review. */
    @GetMapping("/api/claims/stats/open-by-officer")
    Map<Long, Long> openClaimsByOfficer();
}
