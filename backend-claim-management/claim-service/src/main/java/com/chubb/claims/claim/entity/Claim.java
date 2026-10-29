package com.chubb.claims.claim.entity;

import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.common.model.Market;
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
import java.util.Objects;
import java.util.UUID;

/**
 * claimantId / assignedOfficerId reference rows owned by other services, so they are plain columns, not joins.
 * The claimant's name and market are snapshots taken when the claim was filed.
 */
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

    // claimantName and market are nullable columns: ddl-auto=update cannot add NOT NULL to a table that already has
    // rows; the constructor enforces them
    @Column(length = 100)
    private String claimantName;

    @Enumerated(EnumType.STRING)
    @Column(length = 2)
    private Market market;

    // Set by the server when the claim is filed (ClaimService.policyNumberFor), never taken from the request. Nullable:
    // claims filed before this column existed have none.
    @Column(length = 30)
    private String policyNumber;

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

    private Long assignedOfficerId;

    // Information asked of the claimant and their latest reply. All nullable; exposed through getInfoRequest() and
    // getLastReply() below, so there are deliberately no getters for the raw columns.
    @Column(length = 500)
    private String infoRequestMessage;

    @Column(length = 50)
    private String infoRequestedBy;

    private LocalDateTime infoRequestedAt;

    @Column(length = 500)
    private String infoReplyMessage;

    @Column(length = 50)
    private String infoRepliedBy;

    private LocalDateTime infoRepliedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected Claim() {
    }

    public Claim(Long claimantId, String claimantName, Market market, ClaimType claimType, String description,
                 BigDecimal claimAmount, LocalDate incidentDate) {
        this.claimantId = claimantId;
        this.claimantName = Objects.requireNonNull(claimantName, "claimantName");
        this.market = Objects.requireNonNull(market, "market");
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

    /** The policy this claim is filed under; decided by the server once, at filing. */
    public void assignPolicyNumber(String policyNumber) {
        this.policyNumber = policyNumber;
    }

    public void assignTo(Long officerId, ClaimStatus newStatus) {
        this.assignedOfficerId = officerId;
        this.status = newStatus;
    }

    public void changeStatus(ClaimStatus newStatus) {
        this.status = newStatus;
    }

    /** An officer or manager asks the claimant for more information: the claim now waits for them. */
    public void requestInformation(String message, String requestedBy) {
        this.status = ClaimStatus.ON_HOLD;
        this.infoRequestMessage = message;
        this.infoRequestedBy = requestedBy;
        this.infoRequestedAt = LocalDateTime.now();
    }

    /** The claimant's reply puts the claim back under review. */
    public void receiveInformation(String message, String repliedBy) {
        this.status = ClaimStatus.UNDER_REVIEW;
        this.infoReplyMessage = message;
        this.infoRepliedBy = repliedBy;
        this.infoRepliedAt = LocalDateTime.now();
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

    public String getClaimantName() {
        return claimantName;
    }

    public Market getMarket() {
        return market;
    }

    public String getPolicyNumber() {
        return policyNumber;
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

    public Long getAssignedOfficerId() {
        return assignedOfficerId;
    }

    /** What the claimant is being asked for; only while the claim is waiting for them, otherwise null. */
    public InfoRequest getInfoRequest() {
        if (status != ClaimStatus.ON_HOLD || infoRequestMessage == null) {
            return null;
        }
        return new InfoRequest(infoRequestMessage, infoRequestedBy, infoRequestedAt);
    }

    /** The claimant's most recent reply, kept after review resumes; null until they have answered. */
    public InfoReply getLastReply() {
        return infoReplyMessage == null ? null : new InfoReply(infoReplyMessage, infoRepliedBy, infoRepliedAt);
    }

    public record InfoRequest(String message, String requestedBy, LocalDateTime requestedAt) {
    }

    public record InfoReply(String message, String repliedBy, LocalDateTime repliedAt) {
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
