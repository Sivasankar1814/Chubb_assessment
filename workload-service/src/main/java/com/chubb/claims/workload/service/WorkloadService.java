package com.chubb.claims.workload.service;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.workload.client.ClaimClient;
import com.chubb.claims.workload.client.UserClient;
import com.chubb.claims.workload.client.UserClient.OfficerSummary;
import com.chubb.claims.workload.model.OfficerWorkload;
import com.chubb.claims.workload.model.OfficerWorkload.Level;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Combines officer capacity (user-service) with open claim counts (claim-service). */
@Service
public class WorkloadService {

    private static final String OFFICER_ROLE = "OFFICER";

    private final UserClient userClient;
    private final ClaimClient claimClient;

    public WorkloadService(UserClient userClient, ClaimClient claimClient) {
        this.userClient = userClient;
        this.claimClient = claimClient;
    }

    /** Workload of every active officer, least loaded first. */
    public List<OfficerWorkload> getAll() {
        Map<Long, Long> openClaims = claimClient.openClaimsByOfficer();
        return userClient.list(OFFICER_ROLE, true).stream()
                .map(s -> calculate(s, openClaims.getOrDefault(s.id(), 0L)))
                .sorted(Comparator.comparing(OfficerWorkload::utilizationPercent)
                        .thenComparing(OfficerWorkload::officerId))
                .toList();
    }

    public OfficerWorkload getForOfficer(long officerId) {
        OfficerSummary officer = userClient.getById(officerId);
        if (!OFFICER_ROLE.equals(officer.role())) {
            throw new ResourceNotFoundException("Officer", officerId);
        }
        long open = claimClient.openClaimsByOfficer().getOrDefault(officerId, 0L);
        return calculate(officer, open);
    }

    /** The active officer with the lowest utilisation who still has spare capacity. */
    public OfficerWorkload suggestAssignee() {
        return getAll().stream()
                .filter(w -> w.availableCapacity() > 0)
                .findFirst()
                .orElseThrow(() -> new BusinessRuleException("No officer currently has spare capacity"));
    }

    static OfficerWorkload calculate(OfficerSummary officer, long openClaims) {
        BigDecimal utilization = officer.maxCapacity() <= 0
                ? BigDecimal.valueOf(100).setScale(1)
                : BigDecimal.valueOf(openClaims * 100.0 / officer.maxCapacity()).setScale(1, RoundingMode.HALF_UP);
        long available = Math.max(0, officer.maxCapacity() - openClaims);
        return new OfficerWorkload(officer.id(), officer.fullName(), officer.specialization(), officer.maxCapacity(),
                openClaims, available, utilization, Level.of(utilization));
    }
}
