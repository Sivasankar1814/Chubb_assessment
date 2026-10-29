package com.chubb.claims.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.common.model.Market;
import com.chubb.claims.user.dto.CreateUserRequest;
import com.chubb.claims.user.dto.UpdateUserRequest;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    @Mock
    private UserRepository repository;

    private UserService service() {
        return new UserService(repository, encoder);
    }

    private CreateUserRequest claimant() {
        return new CreateUserRequest("jdoe", "secret1", Role.CLAIMANT, "John Doe", "john@example.com",
                "+65-91234567", null, Market.SG, "POL-1", null, null);
    }

    private CreateUserRequest officer() {
        return new CreateUserRequest("asmith", "secret1", Role.OFFICER, "Anna Smith", "anna@chubb.example.com",
                null, null, null, null, "PROPERTY", 6);
    }

    private User user(long id, Role role) {
        User user = new User("existing", "hash", role, "Existing", "e@example.com", null, true);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void managerCreatesOfficerWithHashedPasswordAndDefaultsToActive() {
        when(repository.findByUsername("asmith")).thenReturn(Optional.empty());
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        User created = service().create(officer());

        assertThat(created.getRole()).isEqualTo(Role.OFFICER);
        assertThat(created.isActive()).isTrue();
        assertThat(created.getSpecialization()).isEqualTo("PROPERTY");
        assertThat(created.getMaxCapacity()).isEqualTo(6);
        assertThat(created.getMarket()).isNull();
        assertThat(created.getPasswordHash()).isNotEqualTo("secret1");
        assertThat(encoder.matches("secret1", created.getPasswordHash())).isTrue();
    }

    @Test
    void officerMayRegisterClaimants() {
        when(repository.findByUsername("jdoe")).thenReturn(Optional.empty());
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        User created = service().create(claimant());

        assertThat(created.getRole()).isEqualTo(Role.CLAIMANT);
        assertThat(created.getPolicyNumber()).isEqualTo("POL-1");
        assertThat(created.getMarket()).isEqualTo(Market.SG);
    }

    @Test
    void anyRoleCanBeCreated() {
        CreateUserRequest manager = new CreateUserRequest("mgr", "secret1", Role.MANAGER, "Mia Grant",
                "mia@chubb.example.com", null, null, null, null, null, null);
        when(repository.findByUsername(any())).thenReturn(Optional.empty());
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        assertThat(service().create(officer()).getRole()).isEqualTo(Role.OFFICER);
        assertThat(service().create(manager).getRole()).isEqualTo(Role.MANAGER);
        assertThat(service().create(claimant()).getRole()).isEqualTo(Role.CLAIMANT);
    }

    @Test
    void duplicateUsernameIsRejected() {
        when(repository.findByUsername("jdoe")).thenReturn(Optional.of(user(1, Role.CLAIMANT)));

        assertThatThrownBy(() -> service().create(claimant())).isInstanceOf(BusinessRuleException.class);
        verify(repository, never()).save(any(User.class));
    }

    @Test
    void officerNeedsNoDetailsAndGetsTheDefaultCapacity() {
        CreateUserRequest bare = new CreateUserRequest("s", "secret1", Role.OFFICER, "S", "s@example.com", null,
                null, null, null, "  ", null);
        when(repository.findByUsername(any())).thenReturn(Optional.empty());
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        User created = service().create(bare);

        assertThat(created.getRole()).isEqualTo(Role.OFFICER);
        assertThat(created.getSpecialization()).isNull();
        // Never empty: a missing capacity would read as 0 downstream and the officer could never take a claim.
        assertThat(created.getMaxCapacity()).isEqualTo(UserService.DEFAULT_OFFICER_CAPACITY).isEqualTo(5);
    }

    @Test
    void officerDetailsThatAreGivenAreKept() {
        CreateUserRequest detailed = new CreateUserRequest("t", "secret1", Role.OFFICER, "T", "t@example.com", null,
                null, null, null, "MOTOR", 8);
        CreateUserRequest onlyCapacity = new CreateUserRequest("u", "secret1", Role.OFFICER, "U", "u@example.com", null,
                null, null, null, null, 3);
        when(repository.findByUsername(any())).thenReturn(Optional.empty());
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        User first = service().create(detailed);
        User second = service().create(onlyCapacity);

        assertThat(first.getSpecialization()).isEqualTo("MOTOR");
        assertThat(first.getMaxCapacity()).isEqualTo(8);
        assertThat(second.getSpecialization()).isNull();
        assertThat(second.getMaxCapacity()).isEqualTo(3);
    }

    @Test
    void claimantNeedsNeitherMarketNorPolicyNumber() {
        CreateUserRequest bare = new CreateUserRequest("c", "secret1", Role.CLAIMANT, "C", "c@example.com", null,
                null, null, "  ", null, null);
        when(repository.findByUsername("c")).thenReturn(Optional.empty());
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        User created = service().create(bare);

        assertThat(created.getRole()).isEqualTo(Role.CLAIMANT);
        assertThat(created.getMarket()).isNull();
        assertThat(created.getPolicyNumber()).isNull();
    }

    @Test
    void getByIdThrowsWhenMissing() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().getById(99)).isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void searchPassesFiltersThrough() {
        when(repository.search(Role.OFFICER, true)).thenReturn(List.of(user(3, Role.OFFICER)));

        assertThat(service().search(Role.OFFICER, true)).hasSize(1);
    }

    @Test
    void updateChangesProfileAndOnlyRehashesWhenPasswordGiven() {
        User existing = user(4, Role.OFFICER);
        existing.setOfficerDetails("MOTOR", 8);
        when(repository.findById(4L)).thenReturn(Optional.of(existing));
        when(repository.save(any(User.class))).thenAnswer(call -> call.getArgument(0));

        service().update(4, new UpdateUserRequest("New Name", "new@example.com", null, false, null, null, null,
                "HEALTH", 3));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getFullName()).isEqualTo("New Name");
        assertThat(saved.getValue().isActive()).isFalse();
        assertThat(saved.getValue().getMaxCapacity()).isEqualTo(3);
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("hash");
    }

    @Test
    void deleteThrowsWhenMissing() {
        when(repository.existsById(5L)).thenReturn(false);

        assertThatThrownBy(() -> service().delete(5)).isInstanceOf(ResourceNotFoundException.class);
    }
}
