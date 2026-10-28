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
import org.springframework.security.access.AccessDeniedException;
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

        User created = service().create(officer(), true);

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

        User created = service().create(claimant(), false);

        assertThat(created.getRole()).isEqualTo(Role.CLAIMANT);
        assertThat(created.getPolicyNumber()).isEqualTo("POL-1");
        assertThat(created.getMarket()).isEqualTo(Market.SG);
    }

    @Test
    void officerCannotCreateOfficerOrManagers() {
        assertThatThrownBy(() -> service().create(officer(), false)).isInstanceOf(AccessDeniedException.class);
        verify(repository, never()).save(any(User.class));
    }

    @Test
    void duplicateUsernameIsRejected() {
        when(repository.findByUsername("jdoe")).thenReturn(Optional.of(user(1, Role.CLAIMANT)));

        assertThatThrownBy(() -> service().create(claimant(), true)).isInstanceOf(BusinessRuleException.class);
        verify(repository, never()).save(any(User.class));
    }

    @Test
    void roleSpecificFieldsAreMandatory() {
        CreateUserRequest claimantWithoutPolicy = new CreateUserRequest("c", "secret1", Role.CLAIMANT, "C",
                "c@example.com", null, null, Market.JP, null, null, null);
        CreateUserRequest claimantWithoutMarket = new CreateUserRequest("m", "secret1", Role.CLAIMANT, "M",
                "m@example.com", null, null, null, "POL-2", null, null);
        CreateUserRequest officerWithoutCapacity = new CreateUserRequest("s", "secret1", Role.OFFICER, "S",
                "s@example.com", null, null, null, null, "MOTOR", null);
        when(repository.findByUsername(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().create(claimantWithoutPolicy, true))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("policyNumber");
        assertThatThrownBy(() -> service().create(claimantWithoutMarket, true))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("market");
        assertThatThrownBy(() -> service().create(officerWithoutCapacity, true))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("maxCapacity");
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
