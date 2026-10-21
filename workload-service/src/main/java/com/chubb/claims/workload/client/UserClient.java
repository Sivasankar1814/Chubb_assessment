package com.chubb.claims.workload.client;

import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "user-service", url = "${services.user.url:http://localhost:8081}")
public interface UserClient {

    @GetMapping("/api/users")
    List<StaffSummary> list(@RequestParam("role") String role, @RequestParam("active") Boolean active);

    @GetMapping("/api/users/{id}")
    StaffSummary getById(@PathVariable("id") Long id);

    record StaffSummary(Long id, String fullName, String role, String specialization, int maxCapacity,
                        boolean active) {
    }
}
