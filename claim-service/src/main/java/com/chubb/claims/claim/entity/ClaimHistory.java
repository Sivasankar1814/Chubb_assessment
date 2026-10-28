package com.chubb.claims.claim.entity;

import com.chubb.claims.claim.model.ClaimStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.chubb.claims.common.model.Market;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Immutable audit entry; one row per creation, assignment or status change. Its JSON also shows the claim it belongs to
 * (id, claimant name, market) so a history reads on its own.
 */
@JsonPropertyOrder({"id", "claimId", "claimantName", "market", "action", "fromStatus", "toStatus", "changedBy",
        "remarks", "changedAt"})
@Entity
@Table(name = "claim_history")
public class ClaimHistory {

    public enum Action {
        CREATED, ASSIGNED, REASSIGNED, STATUS_CHANGED, INFO_REQUESTED, INFO_PROVIDED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "claim_id", nullable = false, updatable = false)
    private Claim claim;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(updatable = false, length = 20)
    private ClaimStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private ClaimStatus toStatus;

    @Column(nullable = false, updatable = false, length = 50)
    private String changedBy;

    @Column(updatable = false, length = 500)
    private String remarks;

    @Column(nullable = false, updatable = false)
    private LocalDateTime changedAt;

    protected ClaimHistory() {
    }

    public ClaimHistory(Claim claim, Action action, ClaimStatus fromStatus, ClaimStatus toStatus, String changedBy,
                        String remarks) {
        this.claim = claim;
        this.action = action;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.changedBy = changedBy;
        this.remarks = remarks;
    }

    @PrePersist
    void onCreate() {
        if (changedAt == null) {
            changedAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    @JsonProperty("claimId")
    public Long getClaimId() {
        return claim.getId();
    }

    /** Needs the claim to be loaded: see {@code ClaimHistoryRepository}. */
    @JsonProperty("claimantName")
    public String getClaimantName() {
        return claim.getClaimantName();
    }

    @JsonProperty("market")
    public Market getMarket() {
        return claim.getMarket();
    }

    public Action getAction() {
        return action;
    }

    public ClaimStatus getFromStatus() {
        return fromStatus;
    }

    public ClaimStatus getToStatus() {
        return toStatus;
    }

    public String getChangedBy() {
        return changedBy;
    }

    public String getRemarks() {
        return remarks;
    }

    public LocalDateTime getChangedAt() {
        return changedAt;
    }
}
