package com.chubb.claims.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.security.JwtProperties;
import com.chubb.claims.user.dto.CreateUserRequest;
import com.chubb.claims.user.dto.LoginRequest;
import com.chubb.claims.user.dto.RegisterRequest;
import com.chubb.claims.user.dto.ResetPasswordRequest;
import com.chubb.claims.user.dto.TokenResponse;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtProperties jwtProperties = new JwtProperties();
    private final JwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtProperties.secretKey())
            .macAlgorithm(MacAlgorithm.HS256).build();
    @Mock
    private UserRepository users;
    @Mock
    private UserService userService;

    private AuthService service() {
        return new AuthService(users, encoder, new TokenService(jwtProperties), userService);
    }

    private User officer1(boolean active) {
        User user = new User("officer1", encoder.encode("officer123"), Role.OFFICER, "Priya Nair", "p@example.com", null, active);
        return user;
    }

    @Test
    void validLoginReturnsSignedTokenCarryingUsernameAndRole() {
        when(users.findByUsername("officer1")).thenReturn(Optional.of(officer1(true)));

        TokenResponse response = service().login(new LoginRequest("officer1", "officer123"));

        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresInSeconds()).isEqualTo(jwtProperties.getExpirationMinutes() * 60);
        assertThat(response.roles()).containsExactly("OFFICER");
        Jwt decoded = decoder.decode(response.accessToken());
        assertThat(decoded.getSubject()).isEqualTo("officer1");
        assertThat(decoded.getClaimAsStringList("roles")).containsExactly("OFFICER");
        assertThat(decoded.getClaimAsString("iss")).isEqualTo(jwtProperties.getIssuer());
    }

    @Test
    void wrongPasswordIsRejected() {
        when(users.findByUsername("officer1")).thenReturn(Optional.of(officer1(true)));

        assertThatThrownBy(() -> service().login(new LoginRequest("officer1", "nope")))
                .isInstanceOf(BadCredentialsException.class).hasMessage("Invalid username or password");
    }

    @Test
    void unknownUserGetsTheSameMessageAsWrongPassword() {
        when(users.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().login(new LoginRequest("ghost", "whatever")))
                .isInstanceOf(BadCredentialsException.class).hasMessage("Invalid username or password");
    }

    @Test
    void disabledAccountCannotLogIn() {
        when(users.findByUsername("officer1")).thenReturn(Optional.of(officer1(false)));

        assertThatThrownBy(() -> service().login(new LoginRequest("officer1", "officer123")))
                .isInstanceOf(BadCredentialsException.class).hasMessage("Invalid username or password");
    }

    // ---- sign-up without logging in ----

    @Test
    void registerCreatesAnActiveAccountOfTheRoleTheVisitorChoseAndNothingMore() {
        User created = officer1(true);
        when(userService.create(any())).thenReturn(created);

        User result = service().register(new RegisterRequest("newbie", "secret1", Role.MANAGER, "Nia Cole",
                "nia@example.com", "+65 9123 4567"));

        assertThat(result).isSameAs(created);
        ArgumentCaptor<CreateUserRequest> sent = ArgumentCaptor.forClass(CreateUserRequest.class);
        verify(userService).create(sent.capture());
        CreateUserRequest request = sent.getValue();
        assertThat(request.role()).isEqualTo(Role.MANAGER); // the visitor's choice, as asked for
        assertThat(request.active()).isTrue();
        assertThat(request.username()).isEqualTo("newbie");
        assertThat(request.password()).isEqualTo("secret1");
        assertThat(request.fullName()).isEqualTo("Nia Cole");
        assertThat(request.email()).isEqualTo("nia@example.com");
        assertThat(request.phone()).isEqualTo("+65 9123 4567");
        // only staff set these: a visitor cannot reach them through the public endpoint
        assertThat(request.market()).isNull();
        assertThat(request.policyNumber()).isNull();
        assertThat(request.specialization()).isNull();
        assertThat(request.maxCapacity()).isNull();
    }

    @Test
    void registerWithATakenUsernameIsRefusedByTheSharedCreateRule() {
        when(userService.create(any())).thenThrow(new BusinessRuleException("User with username 'officer1' already exists"));

        assertThatThrownBy(() -> service().register(new RegisterRequest("officer1", "secret1", Role.CLAIMANT, "Nia Cole",
                "nia@example.com", null)))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("already exists");
    }

    // ---- reset without logging in ----

    private static final String NO_MATCH = "Those details do not match an active account";

    @Test
    void resetSetsTheNewPasswordWhenUsernameAndEmailMatch() {
        User user = officer1(true);
        when(users.findByUsername("officer1")).thenReturn(Optional.of(user));

        service().resetPassword(new ResetPasswordRequest("officer1", "p@example.com", "brandnew1"));

        assertThat(encoder.matches("brandnew1", user.getPasswordHash())).isTrue();
        assertThat(encoder.matches("officer123", user.getPasswordHash())).isFalse();
        verify(users).save(user);
    }

    @Test
    void resetIgnoresCaseAndSurroundingSpacesInTheEmail() {
        User user = officer1(true);
        when(users.findByUsername("officer1")).thenReturn(Optional.of(user));

        service().resetPassword(new ResetPasswordRequest("officer1", "  P@Example.COM ", "brandnew1"));

        assertThat(encoder.matches("brandnew1", user.getPasswordHash())).isTrue();
    }

    @Test
    void aWrongEmailChangesNothing() {
        User user = officer1(true);
        when(users.findByUsername("officer1")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service().resetPassword(new ResetPasswordRequest("officer1", "other@example.com", "brandnew1")))
                .isInstanceOf(BusinessRuleException.class).hasMessage(NO_MATCH);

        assertThat(encoder.matches("officer123", user.getPasswordHash())).isTrue();
        verify(users, never()).save(any());
    }

    @Test
    void anUnknownUserAnAnInactiveAccountAndAWrongEmailAllGetTheSameMessage() {
        when(users.findByUsername("ghost")).thenReturn(Optional.empty());
        User inactive = officer1(false);
        when(users.findByUsername("officer1")).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> service().resetPassword(new ResetPasswordRequest("ghost", "p@example.com", "brandnew1")))
                .isInstanceOf(BusinessRuleException.class).hasMessage(NO_MATCH);
        assertThatThrownBy(() -> service().resetPassword(new ResetPasswordRequest("officer1", "p@example.com", "brandnew1")))
                .isInstanceOf(BusinessRuleException.class).hasMessage(NO_MATCH);

        assertThat(encoder.matches("officer123", inactive.getPasswordHash())).isTrue();
        verify(users, never()).save(any());
    }
}
