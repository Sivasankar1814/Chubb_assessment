package com.chubb.claims.workload.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.workload.client.ClaimClient;
import com.chubb.claims.workload.client.UserClient;
import com.chubb.claims.workload.client.UserClient.OfficerSummary;
import com.chubb.claims.workload.model.OfficerWorkload;
import com.chubb.claims.workload.model.OfficerWorkload.Level;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkloadServiceTest {

    @Mock
    private UserClient userClient;
    @Mock
    private ClaimClient claimClient;
    @InjectMocks
    private WorkloadService service;

    private OfficerSummary officer(long id, int capacity) {
        return new OfficerSummary(id, "Officer " + id, "OFFICER", "MOTOR", capacity, true);
    }

    @Test
    void calculatesUtilizationAndLevel() {
        OfficerWorkload w = WorkloadService.calculate(officer(1, 8), 3);

        assertThat(w.utilizationPercent()).isEqualByComparingTo("37.5");
        assertThat(w.availableCapacity()).isEqualTo(5);
        assertThat(w.level()).isEqualTo(Level.LOW);
    }

    @Test
    void overCapacityNeverReportsNegativeAvailability() {
        OfficerWorkload w = WorkloadService.calculate(officer(1, 2), 3);

        assertThat(w.availableCapacity()).isZero();
        assertThat(w.utilizationPercent()).isEqualByComparingTo("150.0");
        assertThat(w.level()).isEqualTo(Level.FULL);
    }

    @Test
    void getAllSortsLeastUtilisedFirstAndDefaultsMissingCountsToZero() {
        when(userClient.list("OFFICER", true)).thenReturn(List.of(officer(1, 4), officer(2, 4), officer(3, 4)));
        when(claimClient.openClaimsByOfficer()).thenReturn(Map.of(1L, 3L, 2L, 1L));

        List<OfficerWorkload> result = service.getAll();

        assertThat(result).extracting(OfficerWorkload::officerId).containsExactly(3L, 2L, 1L);
        assertThat(result.get(0).openClaims()).isZero();
    }

    @Test
    void suggestionSkipsOfficerWithoutCapacity() {
        when(userClient.list("OFFICER", true)).thenReturn(List.of(officer(1, 2), officer(2, 4)));
        when(claimClient.openClaimsByOfficer()).thenReturn(Map.of(1L, 2L, 2L, 3L));

        assertThat(service.suggestAssignee().officerId()).isEqualTo(2L);
    }

    @Test
    void suggestionFailsWhenEveryoneIsFull() {
        when(userClient.list("OFFICER", true)).thenReturn(List.of(officer(1, 1)));
        when(claimClient.openClaimsByOfficer()).thenReturn(Map.of(1L, 1L));

        assertThatThrownBy(service::suggestAssignee).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void getForOfficerRejectsUsersWhoAreNotOfficer() {
        when(userClient.getById(1L)).thenReturn(new OfficerSummary(1L, "Aiko", "CLAIMANT", null, 0, true));

        assertThatThrownBy(() -> service.getForOfficer(1)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getForOfficerUsesClaimCount() {
        when(userClient.getById(1L)).thenReturn(officer(1, 10));
        when(claimClient.openClaimsByOfficer()).thenReturn(Map.of(1L, 8L));

        OfficerWorkload w = service.getForOfficer(1);

        assertThat(w.openClaims()).isEqualTo(8);
        assertThat(w.level()).isEqualTo(Level.HIGH);
    }
}
