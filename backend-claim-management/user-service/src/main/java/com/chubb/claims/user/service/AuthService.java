package com.chubb.claims.user.service;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.user.dto.CreateUserRequest;
import com.chubb.claims.user.dto.LoginRequest;
import com.chubb.claims.user.dto.RegisterRequest;
import com.chubb.claims.user.dto.ResetPasswordRequest;
import com.chubb.claims.user.dto.TokenResponse;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import java.time.Duration;
import java.util.List;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** What an anonymous caller may do: log in, sign up, and set a new password. */
@Service
public class AuthService {

    private static final String BAD_LOGIN = "Invalid username or password";
    private static final String NO_MATCH = "Those details do not match an active account";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;
    private final UserService userService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenService tokens,
                       UserService userService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.userService = userService;
    }

    /**
     * Sign-up with no caller: any role, as the visitor chose (asked for, knowing a visitor can thereby make themselves
     * a manager). Everything else is {@link UserService#create}, so the duplicate-username rule is the same one.
     */
    public User register(RegisterRequest request) {
        return userService.create(new CreateUserRequest(request.username(), request.password(), request.role(),
                request.fullName(), request.email(), request.phone(), true, null, null, null, null));
    }

    /**
     * Sets a new password for whoever names an active account and the email registered with it. An email is not a
     * secret, so this is weak by design (the user chose it over a mailed link); tokens already issued stay valid.
     * One message for an unknown user, an inactive account and a wrong email, so it says which part was wrong to nobody.
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.email().trim();
        User user = users.findByUsername(request.username())
                .filter(User::isActive)
                .filter(u -> u.getEmail().trim().equalsIgnoreCase(email))
                .orElseThrow(() -> new BusinessRuleException(NO_MATCH));
        user.changePasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
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
