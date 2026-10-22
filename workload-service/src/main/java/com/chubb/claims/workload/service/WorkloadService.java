package com.chubb.claims.workload.service;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.workload.client.ClaimClient;
import com.chubb.claims.workload.client.UserClient;
import com.chubb.claims.workload.client.UserClient.StaffSummary;
import com.chubb.claims.workload.model.StaffWorkload;
import com.chubb.claims.workload.model.StaffWorkload.Level;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Combines staff capacity (user-service) with open claim counts (claim-service). */
@Service
public class WorkloadService {

    private static final String STAFF_ROLE = "STAFF";

    private final UserClient userClient;
    private final ClaimClient claimClient;

    public WorkloadService(UserClient userClient, ClaimClient claimClient) {
        this.userClient = userClient;
        this.claimClient = claimClient;
    }

    /** Workload of every active staff member, least loaded first. */
    public List<StaffWorkload> getAll() {
        Map<Long, Long> openClaims = claimClient.openClaimsByStaff();
        return userClient.list(STAFF_ROLE, true).stream()
                .map(s -> calculate(s, openClaims.getOrDefault(s.id(), 0L)))
                .sorted(Comparator.comparing(StaffWorkload::utilizationPercent)
                        .thenComparing(StaffWorkload::staffId))
                .toList();
    }

    public StaffWorkload getForStaff(long staffId) {
        StaffSummary staff = userClient.getById(staffId);
        if (!STAFF_ROLE.equals(staff.role())) {
            throw new ResourceNotFoundException("Staff", staffId);
        }
        long open = claimClient.openClaimsByStaff().getOrDefault(staffId, 0L);
        return calculate(staff, open);
    }

    /** The active staff member with the lowest utilisation who still has spare capacity. */
    public StaffWorkload suggestAssignee() {
        return getAll().stream()
                .filter(w -> w.availableCapacity() > 0)
                .findFirst()
                .orElseThrow(() -> new BusinessRuleException("No staff member currently has spare capacity"));
    }

    static StaffWorkload calculate(StaffSummary staff, long openClaims) {
        BigDecimal utilization = staff.maxCapacity() <= 0
                ? BigDecimal.valueOf(100).setScale(1)
                : BigDecimal.valueOf(openClaims * 100.0 / staff.maxCapacity()).setScale(1, RoundingMode.HALF_UP);
        long available = Math.max(0, staff.maxCapacity() - openClaims);
        return new StaffWorkload(staff.id(), staff.fullName(), staff.specialization(), staff.maxCapacity(),
                openClaims, available, utilization, Level.of(utilization));
    }
}
