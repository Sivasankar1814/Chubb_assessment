package com.chubb.claims.user.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chubb.claims.common.CommonAutoConfiguration;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.service.UserService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest(UserController.class)
@Import(CommonAutoConfiguration.class)
class UserControllerTest {

    private static final String CLAIMANT_BODY = """
            {"username":"jdoe","password":"secret1","role":"CLAIMANT","fullName":"John Doe",
             "email":"john@example.com","phone":"+65-91234567","market":"SG","policyNumber":"POL-1"}""";

    @Autowired
    private MockMvc mvc;
    @MockBean
    private UserService service;

    private static RequestPostProcessor as(String username, String role) {
        return jwt().jwt(token -> token.subject(username)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private User user(long id, String username, Role role) {
        User user = new User(username, "secret-hash", role, "John Doe", "john@example.com", null, true);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void claimantCannotListUsers() throws Exception {
        mvc.perform(get("/api/users").with(as("claimant1", "CLAIMANT"))).andExpect(status().isForbidden());
    }

    @Test
    void officerCanListAndFilterUsers() throws Exception {
        when(service.search(Role.OFFICER, true)).thenReturn(List.of(user(3, "officer1", Role.OFFICER)));

        mvc.perform(get("/api/users?role=OFFICER&active=true").with(as("manager1", "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("officer1"))
                .andExpect(jsonPath("$[0].role").value("OFFICER"));
    }

    @Test
    void responsesNeverExposeThePasswordHash() throws Exception {
        when(service.getById(1)).thenReturn(user(1, "claimant1", Role.CLAIMANT));

        mvc.perform(get("/api/users/1").with(as("claimant1", "CLAIMANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void officerCanCreateClaimant() throws Exception {
        when(service.create(any(), eq(false))).thenReturn(user(1, "jdoe", Role.CLAIMANT));

        mvc.perform(post("/api/users").with(as("officer1", "OFFICER"))
                        .contentType(MediaType.APPLICATION_JSON).content(CLAIMANT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void unknownMarketIsRejectedWith400() throws Exception {
        mvc.perform(post("/api/users").with(as("manager1", "MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLAIMANT_BODY.replace("\"market\":\"SG\"", "\"market\":\"XX\"")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void claimantCannotCreateUsers() throws Exception {
        mvc.perform(post("/api/users").with(as("claimant1", "CLAIMANT"))
                        .contentType(MediaType.APPLICATION_JSON).content(CLAIMANT_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidPayloadReturnsFieldErrors() throws Exception {
        mvc.perform(post("/api/users").with(as("manager1", "MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"\",\"password\":\"x\",\"email\":\"bad\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.details").isNotEmpty());
    }

    @Test
    void claimantCannotReadAnotherProfile() throws Exception {
        when(service.getById(2)).thenReturn(user(2, "claimant2", Role.CLAIMANT));

        mvc.perform(get("/api/users/2").with(as("claimant1", "CLAIMANT"))).andExpect(status().isForbidden());
    }

    @Test
    void claimantCanReadOwnProfileById() throws Exception {
        when(service.getById(1)).thenReturn(user(1, "claimant1", Role.CLAIMANT));

        mvc.perform(get("/api/users/1").with(as("claimant1", "CLAIMANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("claimant1"));
    }

    @Test
    void anyUserCanReadTheirOwnProfileViaMe() throws Exception {
        when(service.getByUsername("manager1")).thenReturn(user(5, "manager1", Role.MANAGER));

        mvc.perform(get("/api/users/me").with(as("manager1", "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MANAGER"));
    }

    @Test
    void missingUserMapsTo404() throws Exception {
        when(service.getById(9)).thenThrow(new ResourceNotFoundException("User", 9));

        mvc.perform(get("/api/users/9").with(as("officer1", "OFFICER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found with id 9"));
    }
}
