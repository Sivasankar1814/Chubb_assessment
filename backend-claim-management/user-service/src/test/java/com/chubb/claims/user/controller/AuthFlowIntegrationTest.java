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
    void anOfficerCreatedWithNoDetailsHasTheDefaultCapacityAndCanLogIn() throws Exception {
        String manager = login("manager1", "manager123");

        mvc.perform(post("/api/users").header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"officer8","password":"newpass1","role":"OFFICER","fullName":"Kim Reyes",
                                 "email":"kim@chubb.example.com"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("OFFICER"))
                .andExpect(jsonPath("$.maxCapacity").value(5))
                .andExpect(jsonPath("$.specialization").doesNotExist());

        String officer = login("officer8", "newpass1");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + officer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxCapacity").value(5));
    }

    @Test
    void officerRegistersAClaimantWithNoMarketAndTheyCanLogIn() throws Exception {
        String officer = login("officer1", "officer123");

        mvc.perform(post("/api/users").header("Authorization", "Bearer " + officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"claimant9","password":"newpass1","role":"CLAIMANT","fullName":"Nina Park",
                                 "email":"nina@example.com"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.market").doesNotExist())
                .andExpect(jsonPath("$.policyNumber").doesNotExist());

        String claimant = login("claimant9", "newpass1");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + claimant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("claimant9"));
    }

    @Test
    void officerRegistersAManagerWhoCanThenLogInAndListUsers() throws Exception {
        String officer = login("officer1", "officer123");

        mvc.perform(post("/api/users").header("Authorization", "Bearer " + officer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"manager9","password":"newpass1","role":"MANAGER","fullName":"Mina Roy",
                                 "email":"mina@example.com"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("MANAGER"));

        String manager = login("manager9", "newpass1");
        mvc.perform(get("/api/users").header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk());
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

    private ResultActions register(String username, String role) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"username":"%s","password":"firstpass1","role":"%s","fullName":"Self Signup",
                         "email":"self.signup@example.com"}""".formatted(username, role)));
    }

    private ResultActions reset(String username, String email, String newPassword) throws Exception {
        return mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"%s\",\"email\":\"%s\",\"newPassword\":\"%s\"}"
                        .formatted(username, email, newPassword)));
    }

    @Test
    void aVisitorSignsUpWithoutATokenAndLogsInAtOnce() throws Exception {
        register("visitor1", "CLAIMANT").andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("visitor1"))
                .andExpect(jsonPath("$.role").value("CLAIMANT"))
                .andExpect(jsonPath("$.active").value(true));

        String token = login("visitor1", "firstpass1");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Self Signup"));
    }

    @Test
    void aVisitorCanSignUpAsAnOfficerWithTheDefaultCapacityAndEvenAsAManager() throws Exception {
        register("visitor2", "OFFICER").andExpect(status().isCreated())
                .andExpect(jsonPath("$.maxCapacity").value(5));
        register("visitor3", "MANAGER").andExpect(status().isCreated());

        // as asked for: the new manager really is one (it can list users)
        String token = login("visitor3", "firstpass1");
        mvc.perform(get("/api/users").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }

    @Test
    void signingUpWithATakenUsernameIs409() throws Exception {
        register("manager1", "CLAIMANT").andExpect(status().isConflict());
    }

    @Test
    void aPasswordIsResetWithUsernameAndEmailAndOnlyTheNewOneWorksAfterwards() throws Exception {
        register("visitor4", "CLAIMANT").andExpect(status().isCreated());

        reset("visitor4", "Self.Signup@Example.com", "secondpass2").andExpect(status().isNoContent());

        attemptLogin("visitor4", "firstpass1").andExpect(status().isUnauthorized());
        login("visitor4", "secondpass2");
    }

    @Test
    void aResetWithTheWrongEmailOrAnUnknownUserIsRefusedWithTheSameMessageAndChangesNothing() throws Exception {
        register("visitor5", "CLAIMANT").andExpect(status().isCreated());

        reset("visitor5", "someone.else@example.com", "secondpass2").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Those details do not match an active account"));
        reset("nobody-here", "self.signup@example.com", "secondpass2").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Those details do not match an active account"));

        login("visitor5", "firstpass1");
    }

    @Test
    void aManagerAccountIsResetTheSameWay() throws Exception {
        // by design (see CLAUDE.md): the email is the only secret, whatever the role. A registered manager is used so
        // the seeded users, which other tests share, keep their passwords.
        register("visitor6", "MANAGER").andExpect(status().isCreated());

        reset("visitor6", "self.signup@example.com", "secondpass2").andExpect(status().isNoContent());

        attemptLogin("visitor6", "firstpass1").andExpect(status().isUnauthorized());
        login("visitor6", "secondpass2");
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        String token = login("officer1", "officer123");

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token + "x"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(containsString("invalid or has expired")));
    }
}
