package com.chubb.claims.claim.repository;

import com.chubb.claims.claim.entity.ClaimHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClaimHistoryRepository extends JpaRepository<ClaimHistory, Long> {

    List<ClaimHistory> findByClaim_IdOrderByChangedAtAscIdAsc(Long claimId);
}
