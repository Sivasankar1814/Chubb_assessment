package com.chubb.claims.claim.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.common.model.Market;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class StatusUpdateResponseTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void carriesEveryFieldOfTheClaimPlusTheChange() {
        Claim claim = new Claim(8L, "Arjun Mehta", Market.IN, ClaimType.PROPERTY, "Monsoon water damage",
                new BigDecimal("5400.00"), LocalDate.now().minusDays(2));
        ReflectionTestUtils.setField(claim, "id", 15L);
        claim.assignTo(3L, ClaimStatus.UNDER_REVIEW);
        claim.requestInformation("Please send the repair invoice", "officer1");   // fills the nested infoRequest too
        ClaimHistory entry = new ClaimHistory(claim, Action.INFO_REQUESTED, ClaimStatus.UNDER_REVIEW,
                ClaimStatus.ON_HOLD, "officer1", "Documents received");

        JsonNode claimJson = json.valueToTree(claim);
        JsonNode response = json.valueToTree(StatusUpdateResponse.from(claim, ClaimStatus.UNDER_REVIEW, entry));
        assertThat(claimJson.get("infoRequest").get("message").asText()).isEqualTo("Please send the repair invoice");

        // everything the claim shows is still there, with the same value: add a Claim field, add it to the record
        claimJson.fieldNames().forEachRemaining(name ->
                assertThat(response.get(name)).as("field '%s' of Claim", name).isEqualTo(claimJson.get(name)));
        assertThat(response.get("previousStatus").asText()).isEqualTo("UNDER_REVIEW");
        assertThat(response.get("remarks").asText()).isEqualTo("Documents received");
        assertThat(response.get("changedBy").asText()).isEqualTo("officer1");
        assertThat(response.has("changedAt")).isTrue();
    }
}
