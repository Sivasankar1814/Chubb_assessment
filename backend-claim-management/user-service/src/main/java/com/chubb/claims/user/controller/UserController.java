package com.chubb.claims.user.controller;

import com.chubb.claims.user.dto.CreateUserRequest;
import com.chubb.claims.user.dto.UpdateUserRequest;
import com.chubb.claims.user.dto.UserResponse;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "One place for every user: claimants, claims officers and managers")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OFFICER','MANAGER')")
    @Operation(summary = "Create a user of any role (officer or manager)")
    public ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        User created = service.create(request);
        return ResponseEntity.created(URI.create("/api/users/" + created.getId())).body(UserResponse.from(created));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OFFICER','MANAGER')")
    @Operation(summary = "List users, optionally filtered by role and active flag (officer / manager)")
    public List<UserResponse> list(@RequestParam(required = false) Role role,
                                   @RequestParam(required = false) Boolean active) {
        return service.search(role, active).stream().map(UserResponse::from).toList();
    }

    @GetMapping("/me")
    @Operation(summary = "Profile of the logged-in user")
    public UserResponse me(Authentication auth) {
        return UserResponse.from(service.getByUsername(auth.getName()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user by id (claimants may only read their own profile)")
    public UserResponse get(@PathVariable long id, Authentication auth) {
        return UserResponse.from(authorizeAccess(service.getById(id), auth));
    }

    @GetMapping("/by-username/{username}")
    @Operation(summary = "Get a user by username (claimants may only read their own profile)")
    public UserResponse getByUsername(@PathVariable String username, Authentication auth) {
        return UserResponse.from(authorizeAccess(service.getByUsername(username), auth));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    @Operation(summary = "Update a user's profile, status or password (manager)")
    public UserResponse update(@PathVariable long id, @Valid @RequestBody UpdateUserRequest request) {
        return UserResponse.from(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    @Operation(summary = "Delete a user (manager)")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private User authorizeAccess(User user, Authentication auth) {
        boolean privileged = hasRole(auth, "OFFICER") || hasRole(auth, "MANAGER");
        if (!privileged && !user.getUsername().equals(auth.getName())) {
            throw new AccessDeniedException("You can only access your own profile");
        }
        return user;
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }
}
