package com.chubb.claims.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Every person in the system: claimants, claims staff and managers. Identity and login live here; the role decides
 * which of the profile columns apply (claimants: country/policyNumber, staff: specialization/maxCapacity).
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 120)
    private String email;

    @Column(length = 20)
    private String phone;

    @Column(nullable = false)
    private boolean active;

    @Column(length = 50)
    private String country;

    @Column(length = 30)
    private String policyNumber;

    @Column(length = 30)
    private String specialization;

    private Integer maxCapacity;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected User() {
    }

    public User(String username, String passwordHash, Role role, String fullName, String email, String phone,
                boolean active) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.active = active;
    }

    public void updateProfile(String fullName, String email, String phone, boolean active) {
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.active = active;
    }

    public void setClaimantDetails(String country, String policyNumber) {
        this.country = country;
        this.policyNumber = policyNumber;
    }

    public void setStaffDetails(String specialization, Integer maxCapacity) {
        this.specialization = specialization;
        this.maxCapacity = maxCapacity;
    }

    public void changePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public boolean isActive() {
        return active;
    }

    public String getCountry() {
        return country;
    }

    public String getPolicyNumber() {
        return policyNumber;
    }

    public String getSpecialization() {
        return specialization;
    }

    public Integer getMaxCapacity() {
        return maxCapacity;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
