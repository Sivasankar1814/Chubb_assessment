package com.chubb.claims.claim.repository;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.common.model.Market;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClaimRepository extends JpaRepository<Claim, Long> {

    @Query("""
            select c from Claim c
            where (:status is null or c.status = :status)
              and (:claimantId is null or c.claimantId = :claimantId)
              and (:assignedOfficerId is null or c.assignedOfficerId = :assignedOfficerId)
              and (:market is null or c.market = :market)
              and (:claimType is null or c.claimType = :claimType)
            order by c.id desc""")
    List<Claim> search(@Param("status") ClaimStatus status, @Param("claimantId") Long claimantId,
                       @Param("assignedOfficerId") Long assignedOfficerId, @Param("market") Market market,
                       @Param("claimType") ClaimType claimType);

    long countByAssignedOfficerIdAndStatusIn(Long officerId, Collection<ClaimStatus> statuses);

    @Query("""
            select c.assignedOfficerId, count(c) from Claim c
            where c.assignedOfficerId is not null and c.status in :statuses
            group by c.assignedOfficerId""")
    List<Object[]> countGroupedByOfficer(@Param("statuses") Collection<ClaimStatus> statuses);

    default long countOpenByOfficer(long officerId) {
        return countByAssignedOfficerIdAndStatusIn(officerId, ClaimStatus.IN_PROGRESS);
    }

    /** officerId -> number of claims currently being worked on. */
    default Map<Long, Long> countOpenGroupedByOfficer() {
        Map<Long, Long> result = new LinkedHashMap<>();
        for (Object[] row : countGroupedByOfficer(ClaimStatus.IN_PROGRESS)) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }
}
