package com.chubb.claims.claim.entity;

import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** claimantId / assignedStaffId reference rows owned by other services, so they are plain columns, not joins. */
@Entity
@Table(name = "claims")
public class Claim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String claimNumber;

    @Column(nullable = false)
    private Long claimantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClaimType claimType;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal claimAmount;

    @Column(nullable = false)
    private LocalDate incidentDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClaimStatus status;

    private Long assignedStaffId;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected Claim() {
    }

    public Claim(Long claimantId, ClaimType claimType, String description, BigDecimal claimAmount,
                 LocalDate incidentDate) {
        this.claimantId = claimantId;
        this.claimType = claimType;
        this.description = description;
        this.claimAmount = claimAmount;
        this.incidentDate = incidentDate;
        this.status = ClaimStatus.OPEN;
        this.claimNumber = "TMP-" + UUID.randomUUID(); // replaced by assignClaimNumber() once the id exists
    }

    /** Human-readable number such as CLM-2026-000042, derived from the generated id. */
    public void assignClaimNumber() {
        this.claimNumber = "CLM-%d-%06d".formatted(LocalDate.now().getYear(), id);
    }

    public void assignTo(Long staffId, ClaimStatus newStatus) {
        this.assignedStaffId = staffId;
        this.status = newStatus;
    }

    public void changeStatus(ClaimStatus newStatus) {
        this.status = newStatus;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getClaimNumber() {
        return claimNumber;
    }

    public Long getClaimantId() {
        return claimantId;
    }

    public ClaimType getClaimType() {
        return claimType;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getClaimAmount() {
        return claimAmount;
    }

    public LocalDate getIncidentDate() {
        return incidentDate;
    }

    public ClaimStatus getStatus() {
        return status;
    }

    public Long getAssignedStaffId() {
        return assignedStaffId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
