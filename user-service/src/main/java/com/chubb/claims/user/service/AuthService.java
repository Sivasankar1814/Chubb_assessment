package com.chubb.claims.user.service;

import com.chubb.claims.user.dto.LoginRequest;
import com.chubb.claims.user.dto.TokenResponse;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.time.Duration;
import java.util.List;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private static final String BAD_LOGIN = "Invalid username or password";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenService tokens) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
    }

    public TokenResponse login(LoginRequest request) {
        // one message for unknown user, wrong password and disabled account, so usernames cannot be probed
        User user = users.findByUsername(request.username())
                .filter(User::isActive)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException(BAD_LOGIN));
        List<String> roles = List.of(user.getRole().name());
        Jwt jwt = tokens.issue(user.getUsername(), roles);
        long expiresIn = Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt()).getSeconds();
        return new TokenResponse(jwt.getTokenValue(), "Bearer", expiresIn, user.getUsername(), roles);
    }
}
