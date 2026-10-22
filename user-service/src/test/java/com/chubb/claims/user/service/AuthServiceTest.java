package com.chubb.claims.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.chubb.claims.common.security.JwtProperties;
import com.chubb.claims.user.dto.LoginRequest;
import com.chubb.claims.user.dto.TokenResponse;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    private AuthService service() {
        return new AuthService(users, encoder, new TokenService(jwtProperties));
    }

    private User staff1(boolean active) {
        User user = new User("staff1", encoder.encode("staff123"), Role.STAFF, "Priya Nair", "p@example.com", null, active);
        return user;
    }

    @Test
    void validLoginReturnsSignedTokenCarryingUsernameAndRole() {
        when(users.findByUsername("staff1")).thenReturn(Optional.of(staff1(true)));

        TokenResponse response = service().login(new LoginRequest("staff1", "staff123"));

        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresInSeconds()).isEqualTo(jwtProperties.getExpirationMinutes() * 60);
        assertThat(response.roles()).containsExactly("STAFF");
        Jwt decoded = decoder.decode(response.accessToken());
        assertThat(decoded.getSubject()).isEqualTo("staff1");
        assertThat(decoded.getClaimAsStringList("roles")).containsExactly("STAFF");
        assertThat(decoded.getClaimAsString("iss")).isEqualTo(jwtProperties.getIssuer());
    }

    @Test
    void wrongPasswordIsRejected() {
        when(users.findByUsername("staff1")).thenReturn(Optional.of(staff1(true)));

        assertThatThrownBy(() -> service().login(new LoginRequest("staff1", "nope")))
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
        when(users.findByUsername("staff1")).thenReturn(Optional.of(staff1(false)));

        assertThatThrownBy(() -> service().login(new LoginRequest("staff1", "staff123")))
                .isInstanceOf(BadCredentialsException.class).hasMessage("Invalid username or password");
    }
}
