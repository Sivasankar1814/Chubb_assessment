package com.chubb.claims.claim.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.chubb.claims.claim.dto.UpdateStatusRequest;
import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.claim.security.Caller;
import com.chubb.claims.claim.service.ClaimService;
import com.chubb.claims.claim.service.StatusChange;
import com.chubb.claims.common.CommonAutoConfiguration;
import com.chubb.claims.common.model.Market;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest(ClaimController.class)
@Import(CommonAutoConfiguration.class)
class ClaimControllerTest {

    private static final String VALID_BODY = """
            {"claimantName":"Mei Chen","market":"HK","claimType":"MOTOR","description":"Windscreen cracked",
             "claimAmount":900.00,"incidentDate":"%s"}""".formatted(LocalDate.now().minusDays(1));

    @Autowired
    private MockMvc mvc;
    @MockBean
    private ClaimService service;

    private static RequestPostProcessor as(String username, String role) {
        return jwt().jwt(token -> token.subject(username)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private static Claim claim(Market market, ClaimType type, String claimantName) {
        Claim claim = new Claim(2L, claimantName, market, type, "Flood damage", new BigDecimal("3000.00"),
                LocalDate.now().minusDays(1));
        ReflectionTestUtils.setField(claim, "id", 1L);
        return claim;
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/claims")).andExpect(status().isUnauthorized());
    }

    @Test
    void listPassesMarketAndClaimTypeFiltersToTheService() throws Exception {
        when(service.list(isNull(), isNull(), isNull(), eq(Market.TH), eq(ClaimType.PROPERTY), any(Caller.class)))
                .thenReturn(List.of(claim(Market.TH, ClaimType.PROPERTY, "Somchai Prasert")));

        mvc.perform(get("/api/claims?market=TH&claimType=PROPERTY").with(as("manager1", "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].market").value("TH"))
                .andExpect(jsonPath("$[0].claimType").value("PROPERTY"))
                .andExpect(jsonPath("$[0].claimantName").value("Somchai Prasert"));
    }

    @Test
    void unknownMarketIsRejectedWith400() throws Exception {
        mvc.perform(get("/api/claims?market=XX").with(as("manager1", "MANAGER")))
                .andExpect(status().isBadRequest());

        verify(service, never()).list(any(), any(), any(), any(), any(), any());
    }

    @Test
    void createReturnsTheClaimWithItsNameAndMarket() throws Exception {
        when(service.create(any(), any(Caller.class))).thenReturn(claim(Market.HK, ClaimType.MOTOR, "Mei Chen"));

        mvc.perform(post("/api/claims").with(as("claimant3", "CLAIMANT"))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.claimantName").value("Mei Chen"))
                .andExpect(jsonPath("$.market").value("HK"));
    }

    @Test
    void historyShowsTheClaimsClaimantNameAndMarket() throws Exception {
        Claim claim = claim(Market.IN, ClaimType.MOTOR, "Arjun Mehta");
        when(service.getHistory(eq(1L), any(Caller.class))).thenReturn(List.of(
                new ClaimHistory(claim, ClaimHistory.Action.CREATED, null, ClaimStatus.OPEN, "claimant5",
                        "Claim submitted")));

        mvc.perform(get("/api/claims/1/history").with(as("claimant5", "CLAIMANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].claimId").value(1))
                .andExpect(jsonPath("$[0].claimantName").value("Arjun Mehta"))
                .andExpect(jsonPath("$[0].market").value("IN"))
                .andExpect(jsonPath("$[0].action").value("CREATED"))
                .andExpect(jsonPath("$[0].changedBy").value("claimant5"));
    }

    @Test
    void statusUpdateReturnsTheClaimPlusWhatChanged() throws Exception {
        Claim claim = claim(Market.IN, ClaimType.PROPERTY, "Arjun Mehta");
        claim.assignTo(3L, ClaimStatus.UNDER_REVIEW);
        claim.changeStatus(ClaimStatus.APPROVED);
        ClaimHistory entry = new ClaimHistory(claim, ClaimHistory.Action.STATUS_CHANGED, ClaimStatus.UNDER_REVIEW,
                ClaimStatus.APPROVED, "officer1", "Documents verified");
        ReflectionTestUtils.setField(entry, "changedAt", LocalDateTime.of(2026, 10, 27, 14, 10, 30));
        when(service.updateStatus(eq(1L), any(UpdateStatusRequest.class), any(Caller.class)))
                .thenReturn(new StatusChange(claim, ClaimStatus.UNDER_REVIEW, entry));

        mvc.perform(patch("/api/claims/1/status").with(as("officer1", "OFFICER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\",\"remarks\":\"Documents verified\"}"))
                .andExpect(status().isOk())
                // the claim's own fields stay at the top level, as before
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.claimantName").value("Arjun Mehta"))
                .andExpect(jsonPath("$.market").value("IN"))
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.assignedOfficerId").value(3))
                .andExpect(jsonPath("$.claim").doesNotExist())
                // plus what this update did
                .andExpect(jsonPath("$.previousStatus").value("UNDER_REVIEW"))
                .andExpect(jsonPath("$.remarks").value("Documents verified"))
                .andExpect(jsonPath("$.changedBy").value("officer1"))
                .andExpect(jsonPath("$.changedAt").value("2026-10-27T14:10:30"));
    }

    @Test
    void requestingInformationShowsTheOpenRequestInTheStatusResponse() throws Exception {
        Claim claim = claim(Market.IN, ClaimType.PROPERTY, "Arjun Mehta");
        claim.assignTo(3L, ClaimStatus.UNDER_REVIEW);
        claim.requestInformation("Please send the repair invoice", "officer1");
        ClaimHistory entry = new ClaimHistory(claim, ClaimHistory.Action.INFO_REQUESTED, ClaimStatus.UNDER_REVIEW,
                ClaimStatus.ON_HOLD, "officer1", "Please send the repair invoice");
        when(service.updateStatus(eq(1L), any(UpdateStatusRequest.class), any(Caller.class)))
                .thenReturn(new StatusChange(claim, ClaimStatus.UNDER_REVIEW, entry));

        mvc.perform(patch("/api/claims/1/status").with(as("officer1", "OFFICER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ON_HOLD\",\"remarks\":\"Please send the repair invoice\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ON_HOLD"))
                .andExpect(jsonPath("$.previousStatus").value("UNDER_REVIEW"))
                .andExpect(jsonPath("$.infoRequest.message").value("Please send the repair invoice"))
                .andExpect(jsonPath("$.infoRequest.requestedBy").value("officer1"))
                .andExpect(jsonPath("$.lastReply").doesNotExist());
    }

    @Test
    void claimantAnswersAnInformationRequestThroughTheStatusEndpoint() throws Exception {
        Claim claim = claim(Market.IN, ClaimType.PROPERTY, "Arjun Mehta");
        claim.requestInformation("Please send the repair invoice", "officer1");
        claim.receiveInformation("Invoice INV-77 attached", "claimant5");
        ClaimHistory entry = new ClaimHistory(claim, ClaimHistory.Action.INFO_PROVIDED, ClaimStatus.ON_HOLD,
                ClaimStatus.UNDER_REVIEW, "claimant5", "Invoice INV-77 attached");
        when(service.updateStatus(eq(1L), any(UpdateStatusRequest.class), any(Caller.class)))
                .thenReturn(new StatusChange(claim, ClaimStatus.ON_HOLD, entry));

        mvc.perform(patch("/api/claims/1/status").with(as("claimant5", "CLAIMANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"UNDER_REVIEW\",\"remarks\":\"Invoice INV-77 attached\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNDER_REVIEW"))
                .andExpect(jsonPath("$.previousStatus").value("ON_HOLD"))
                .andExpect(jsonPath("$.infoRequest").doesNotExist())
                .andExpect(jsonPath("$.lastReply.message").value("Invoice INV-77 attached"))
                .andExpect(jsonPath("$.lastReply.repliedBy").value("claimant5"))
                .andExpect(jsonPath("$.changedBy").value("claimant5"));
    }

    @Test
    void claimantsAreForbiddenWhateverTheServiceRefuses() throws Exception {
        // the role gate lets claimants in; ClaimService decides, and its AccessDeniedException must come out as 403
        when(service.updateStatus(eq(1L), any(UpdateStatusRequest.class), any(Caller.class)))
                .thenThrow(new AccessDeniedException("Claimants can only answer an information request"));

        mvc.perform(patch("/api/claims/1/status").with(as("claimant5", "CLAIMANT"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"APPROVED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void thereIsNoSeparateInformationEndpointAnyMore() throws Exception {
        mvc.perform(post("/api/claims/1/information").with(as("claimant5", "CLAIMANT"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Invoice attached\"}"))
                .andExpect(status().isNotFound());

        verify(service, never()).updateStatus(anyLong(), any(), any());
    }

    @Test
    void createRequiresMarketAndClaimantName() throws Exception {
        String withoutMarket = VALID_BODY.replace("\"market\":\"HK\",", "");
        String withoutName = VALID_BODY.replace("\"claimantName\":\"Mei Chen\",", "");
        String blankName = VALID_BODY.replace("\"Mei Chen\"", "\"  \"");
        String unknownMarket = VALID_BODY.replace("\"HK\"", "\"XX\"");

        for (String body : List.of(withoutMarket, withoutName, blankName, unknownMarket)) {
            mvc.perform(post("/api/claims").with(as("claimant3", "CLAIMANT"))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }

        verify(service, never()).create(any(), any());
    }
}
