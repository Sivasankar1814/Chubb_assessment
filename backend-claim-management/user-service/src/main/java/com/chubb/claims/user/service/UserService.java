package com.chubb.claims.user.service;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.common.model.Market;
import com.chubb.claims.user.dto.CreateUserRequest;
import com.chubb.claims.user.dto.UpdateUserRequest;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UserService {

    /**
     * What an officer gets when none is given. Capacity cannot simply stay empty: claim-service and workload-service
     * read a missing one as 0, which makes the officer "full" for good (never assignable, never able to pick up a claim).
     * 5 is the demo officer's.
     */
    static final int DEFAULT_OFFICER_CAPACITY = 5;

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    /** Any role may be created by whoever the controller lets in (officers and managers alike). */
    @Transactional
    public User create(CreateUserRequest request) {
        if (repository.findByUsername(request.username()).isPresent()) {
            throw new BusinessRuleException("User with username '" + request.username() + "' already exists");
        }
        User user = new User(request.username(), passwordEncoder.encode(request.password()), request.role(),
                request.fullName(), request.email(), request.phone(), request.active() == null || request.active());
        applyRoleDetails(user, request.market(), request.policyNumber(), request.specialization(),
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
        applyRoleDetails(user, request.market(), request.policyNumber(), request.specialization(),
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

    /** Stores only the profile fields that belong to the user's role; none of them is mandatory. */
    private void applyRoleDetails(User user, Market market, String policyNumber, String specialization,
                                  Integer maxCapacity) {
        switch (user.getRole()) {
            case CLAIMANT -> {
                // Both are optional: the market of a claim is chosen when the claim is filed, so a claimant needs none.
                user.setClaimantDetails(market, StringUtils.hasText(policyNumber) ? policyNumber : null);
            }
            case OFFICER -> {
                // The specialization is only ever displayed; the capacity is what assignment and workload run on.
                user.setOfficerDetails(StringUtils.hasText(specialization) ? specialization : null,
                        maxCapacity != null ? maxCapacity : DEFAULT_OFFICER_CAPACITY);
            }
            case MANAGER -> {
                // no role-specific profile
            }
        }
    }
}
