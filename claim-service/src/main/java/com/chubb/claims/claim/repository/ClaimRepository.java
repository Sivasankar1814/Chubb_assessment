package com.chubb.claims.claim.repository;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.model.ClaimStatus;
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
              and (:assignedStaffId is null or c.assignedStaffId = :assignedStaffId)
            order by c.id desc""")
    List<Claim> search(@Param("status") ClaimStatus status, @Param("claimantId") Long claimantId,
                       @Param("assignedStaffId") Long assignedStaffId);

    long countByAssignedStaffIdAndStatusIn(Long staffId, Collection<ClaimStatus> statuses);

    @Query("""
            select c.assignedStaffId, count(c) from Claim c
            where c.assignedStaffId is not null and c.status in :statuses
            group by c.assignedStaffId""")
    List<Object[]> countGroupedByStaff(@Param("statuses") Collection<ClaimStatus> statuses);

    default long countOpenByStaff(long staffId) {
        return countByAssignedStaffIdAndStatusIn(staffId, ClaimStatus.IN_PROGRESS);
    }

    /** staffId -> number of claims currently being worked on. */
    default Map<Long, Long> countOpenGroupedByStaff() {
        Map<Long, Long> result = new LinkedHashMap<>();
        for (Object[] row : countGroupedByStaff(ClaimStatus.IN_PROGRESS)) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }
}
