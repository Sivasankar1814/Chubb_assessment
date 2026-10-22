package com.chubb.claims.user.service;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.user.dto.CreateUserRequest;
import com.chubb.claims.user.dto.UpdateUserRequest;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    /** Managers create any user; staff may only register claimants. */
    @Transactional
    public User create(CreateUserRequest request, boolean callerIsManager) {
        if (!callerIsManager && request.role() != Role.CLAIMANT) {
            throw new AccessDeniedException("Staff can only register claimants; ask a manager to create "
                    + request.role() + " users");
        }
        if (repository.findByUsername(request.username()).isPresent()) {
            throw new BusinessRuleException("User with username '" + request.username() + "' already exists");
        }
        User user = new User(request.username(), passwordEncoder.encode(request.password()), request.role(),
                request.fullName(), request.email(), request.phone(), request.active() == null || request.active());
        applyRoleDetails(user, request.country(), request.policyNumber(), request.specialization(),
                request.maxCapacity());
        return repository.save(user);
    }

    public User getById(long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    public User getByUsername(String username) {
        return repository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username " + username));
    }

    public List<User> search(Role role, Boolean active) {
        return repository.search(role, active);
    }

    @Transactional
    public User update(long id, UpdateUserRequest request) {
        User user = getById(id);
        user.updateProfile(request.fullName(), request.email(), request.phone(),
                request.active() == null || request.active());
        applyRoleDetails(user, request.country(), request.policyNumber(), request.specialization(),
                request.maxCapacity());
        if (StringUtils.hasText(request.password())) {
            user.changePasswordHash(passwordEncoder.encode(request.password()));
        }
        return repository.save(user);
    }

    @Transactional
    public void delete(long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("User", id);
        }
        repository.deleteById(id);
    }

    /** Stores only the profile fields that belong to the user's role, and insists on the mandatory ones. */
    private void applyRoleDetails(User user, String country, String policyNumber, String specialization,
                                  Integer maxCapacity) {
        switch (user.getRole()) {
            case CLAIMANT -> {
                if (!StringUtils.hasText(country) || !StringUtils.hasText(policyNumber)) {
                    throw new IllegalArgumentException("Claimants require country and policyNumber");
                }
                user.setClaimantDetails(country, policyNumber);
            }
            case STAFF -> {
                if (!StringUtils.hasText(specialization) || maxCapacity == null) {
                    throw new IllegalArgumentException("Staff require specialization and maxCapacity");
                }
                user.setStaffDetails(specialization, maxCapacity);
            }
            case MANAGER -> {
                // no role-specific profile
            }
        }
    }
}
