package com.chubb.claims.user.controller;

import com.chubb.claims.user.dto.LoginRequest;
import com.chubb.claims.user.dto.RegisterRequest;
import com.chubb.claims.user.dto.ResetPasswordRequest;
import com.chubb.claims.user.dto.TokenResponse;
import com.chubb.claims.user.dto.UserResponse;
import com.chubb.claims.user.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Log in to obtain a JWT access token, sign up, or set a new password: no token needed")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    @SecurityRequirements
    @Operation(summary = "Exchange username and password for a JWT; send it as 'Authorization: Bearer <token>'")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @SecurityRequirements
    @Operation(summary = "Sign up without logging in, as a claimant, officer or manager; the account can log in at once")
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return UserResponse.from(service.register(request));
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirements
    @Operation(summary = "Set a new password by giving the username and the email registered with it; no login needed")
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        service.resetPassword(request);
    }
}
