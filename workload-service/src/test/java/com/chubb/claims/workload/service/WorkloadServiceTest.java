package com.chubb.claims.workload.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.workload.client.ClaimClient;
import com.chubb.claims.workload.client.UserClient;
import com.chubb.claims.workload.client.UserClient.StaffSummary;
import com.chubb.claims.workload.model.StaffWorkload;
import com.chubb.claims.workload.model.StaffWorkload.Level;
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

    private StaffSummary staff(long id, int capacity) {
        return new StaffSummary(id, "Staff " + id, "STAFF", "MOTOR", capacity, true);
    }

    @Test
    void calculatesUtilizationAndLevel() {
        StaffWorkload w = WorkloadService.calculate(staff(1, 8), 3);

        assertThat(w.utilizationPercent()).isEqualByComparingTo("37.5");
        assertThat(w.availableCapacity()).isEqualTo(5);
        assertThat(w.level()).isEqualTo(Level.LOW);
    }

    @Test
    void overCapacityNeverReportsNegativeAvailability() {
        StaffWorkload w = WorkloadService.calculate(staff(1, 2), 3);

        assertThat(w.availableCapacity()).isZero();
        assertThat(w.utilizationPercent()).isEqualByComparingTo("150.0");
        assertThat(w.level()).isEqualTo(Level.FULL);
    }

    @Test
    void getAllSortsLeastUtilisedFirstAndDefaultsMissingCountsToZero() {
        when(userClient.list("STAFF", true)).thenReturn(List.of(staff(1, 4), staff(2, 4), staff(3, 4)));
        when(claimClient.openClaimsByStaff()).thenReturn(Map.of(1L, 3L, 2L, 1L));

        List<StaffWorkload> result = service.getAll();

        assertThat(result).extracting(StaffWorkload::staffId).containsExactly(3L, 2L, 1L);
        assertThat(result.get(0).openClaims()).isZero();
    }

    @Test
    void suggestionSkipsStaffWithoutCapacity() {
        when(userClient.list("STAFF", true)).thenReturn(List.of(staff(1, 2), staff(2, 4)));
        when(claimClient.openClaimsByStaff()).thenReturn(Map.of(1L, 2L, 2L, 3L));

        assertThat(service.suggestAssignee().staffId()).isEqualTo(2L);
    }

    @Test
    void suggestionFailsWhenEveryoneIsFull() {
        when(userClient.list("STAFF", true)).thenReturn(List.of(staff(1, 1)));
        when(claimClient.openClaimsByStaff()).thenReturn(Map.of(1L, 1L));

        assertThatThrownBy(service::suggestAssignee).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void getForStaffRejectsUsersWhoAreNotStaff() {
        when(userClient.getById(1L)).thenReturn(new StaffSummary(1L, "Aiko", "CLAIMANT", null, 0, true));

        assertThatThrownBy(() -> service.getForStaff(1)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getForStaffUsesClaimCount() {
        when(userClient.getById(1L)).thenReturn(staff(1, 10));
        when(claimClient.openClaimsByStaff()).thenReturn(Map.of(1L, 8L));

        StaffWorkload w = service.getForStaff(1);

        assertThat(w.openClaims()).isEqualTo(8);
        assertThat(w.level()).isEqualTo(Level.HIGH);
    }
}
