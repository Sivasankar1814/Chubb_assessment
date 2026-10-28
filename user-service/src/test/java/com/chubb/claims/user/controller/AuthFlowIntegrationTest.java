package com.chubb.claims.user.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Full stack on H2: seeded demo users log in, and the issued token drives the real security filter chain. */
@SpringBootTest
@AutoConfigureMockMvc
class AuthFlowIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;

    private ResultActions attemptLogin(String username, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password)));
    }

    private String login(String username, String password) throws Exception {
        String body = attemptLogin(username, password).andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    @Test
    void seededDemoUsersAllExistAndLogIn() throws Exception {
        String token = login("manager1", "manager123");

        mvc.perform(get("/api/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$[0].username").value("claimant1"))
                .andExpect(jsonPath("$[2].role").value("OFFICER"));
    }

    @Test
    void demoClaimantsCoverAllSixMarkets() throws Exception {
        String token = login("manager1", "manager123");

        mvc.perform(get("/api/users?role=CLAIMANT").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].market").value(org.hamcrest.Matchers.hasItems("SG", "HK", "JP", "TH", "IN", "ID")));
    }

    @Test
    void tokenResolvesToTheRightProfile() throws Exception {
        String token = login("officer1", "officer123");

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("officer1"))
                .andExpect(jsonPath("$.role").value("OFFICER"))
                .andExpect(jsonPath("$.maxCapacity").value(5));
    }

    @Test
    void claimantProfileCarriesTheirMarket() throws Exception {
        String token = login("claimant1", "claimant123");

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.market").value("JP"))
                .andExpect(jsonPath("$.country").doesNotExist());
    }

    @Test
    void managerCanCreateAUserWhoThenLogsIn() throws Exception {
        String manager = login("manager1", "manager123");

        mvc.perform(post("/api/users").header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"officer9","password":"newpass1","role":"OFFICER","fullName":"Sam Ortiz",
                                 "email":"sam@chubb.example.com","specialization":"TRAVEL","maxCapacity":4}"""))
                .andExpect(status().isCreated());

        login("officer9", "newpass1");
    }

    @Test
    void deactivatedUserCanNoLongerLogIn() throws Exception {
        String manager = login("manager1", "manager123");
        mvc.perform(put("/api/users/2").header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Wei Lim","email":"wei.lim@example.com","active":false,
                                 "market":"SG","policyNumber":"POL-SG-0002"}"""))
                .andExpect(status().isOk());

        attemptLogin("claimant2", "claimant123").andExpect(status().isUnauthorized());
    }

    @Test
    void badCredentialsReturn401() throws Exception {
        attemptLogin("manager1", "wrong").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void blankFieldsReturn400WithDetails() throws Exception {
        attemptLogin("", "").andExpect(status().isBadRequest()).andExpect(jsonPath("$.details").isNotEmpty());
    }

    @Test
    void missingTokenIsToldSo() throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(containsString("No token was sent")));
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        String token = login("officer1", "officer123");

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token + "x"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(containsString("invalid or has expired")));
    }
}
