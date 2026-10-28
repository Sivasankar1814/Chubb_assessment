package com.chubb.claims.claim.repository;

import com.chubb.claims.claim.entity.ClaimHistory;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClaimHistoryRepository extends JpaRepository<ClaimHistory, Long> {

    /** Loads the claim with the entries: they expose its market and claimant name, and there is no session left when
     *  the controller serialises them (open-in-view is off). */
    @EntityGraph(attributePaths = "claim")
    List<ClaimHistory> findByClaim_IdOrderByChangedAtAscIdAsc(Long claimId);
}
