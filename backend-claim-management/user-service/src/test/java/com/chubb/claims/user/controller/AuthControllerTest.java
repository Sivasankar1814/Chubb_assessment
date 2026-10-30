package com.chubb.claims.user.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chubb.claims.common.CommonAutoConfiguration;
import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** The three endpoints that need no token, with no token at all: nothing else is opened by listing them. */
@WebMvcTest(AuthController.class)
@Import(CommonAutoConfiguration.class)
class AuthControllerTest {

    private static final String REGISTER_BODY = """
            {"username":"newbie","password":"secret1","role":"MANAGER","fullName":"Nia Cole",
             "email":"nia@example.com","phone":"+65 9123 4567"}""";
    private static final String RESET_BODY = """
            {"username":"officer1","email":"p@example.com","newPassword":"brandnew1"}""";

    @Autowired
    private MockMvc mvc;
    @MockBean
    private AuthService service;

    private static User saved(Role role) {
        User user = new User("newbie", "hash", role, "Nia Cole", "nia@example.com", null, true);
        ReflectionTestUtils.setField(user, "id", 42L);
        return user;
    }

    private ResultActions register(String body) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions reset(String body) throws Exception {
        return mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void registerNeedsNoTokenAndAnswersWithTheNewAccountButNeverItsPassword() throws Exception {
        when(service.register(any())).thenReturn(saved(Role.MANAGER));

        register(REGISTER_BODY)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.username").value("newbie"))
                .andExpect(jsonPath("$.role").value("MANAGER"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void registerValidatesTheBody() throws Exception {
        register("""
                {"username":"newbie","password":"short","role":"CLAIMANT","fullName":"Nia Cole","email":"nia@example.com"}""")
                .andExpect(status().isBadRequest());
        register("""
                {"username":"newbie","password":"secret1","role":"CLAIMANT","fullName":"Nia Cole","email":"not-an-email"}""")
                .andExpect(status().isBadRequest());
        register("""
                {"username":"newbie","password":"secret1","fullName":"Nia Cole","email":"nia@example.com"}""")
                .andExpect(status().isBadRequest());
        register("""
                {"username":"newbie","password":"secret1","role":"CLAIMANT","fullName":"Nia Cole",
                 "email":"nia@example.com","phone":"call me"}""")
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void aTakenUsernameIsA409() throws Exception {
        when(service.register(any())).thenThrow(new BusinessRuleException("User with username 'newbie' already exists"));

        register(REGISTER_BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User with username 'newbie' already exists"));
    }

    @Test
    void resetNeedsNoTokenAndAnswersWithNoContent() throws Exception {
        reset(RESET_BODY).andExpect(status().isNoContent());

        verify(service).resetPassword(any());
    }

    @Test
    void resetValidatesTheBody() throws Exception {
        reset("""
                {"username":"officer1","email":"p@example.com","newPassword":"short"}""").andExpect(status().isBadRequest());
        reset("""
                {"username":"officer1","newPassword":"brandnew1"}""").andExpect(status().isBadRequest());
        reset("""
                {"email":"p@example.com","newPassword":"brandnew1"}""").andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void aMismatchIsA409WithTheOneGenericMessage() throws Exception {
        doThrow(new BusinessRuleException("Those details do not match an active account")).when(service).resetPassword(any());

        reset(RESET_BODY)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Those details do not match an active account"));
    }

    @Test
    void listingThemOpensNothingElse() throws Exception {
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }
}
