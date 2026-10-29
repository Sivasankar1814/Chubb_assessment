package com.chubb.claims.claim.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.chubb.claims.claim.client.UserClient;
import com.chubb.claims.claim.client.UserClient.UserSummary;
import com.chubb.claims.claim.dto.AssignClaimRequest;
import com.chubb.claims.claim.dto.CreateClaimRequest;
import com.chubb.claims.claim.dto.UpdateStatusRequest;
import com.chubb.claims.claim.entity.Claim;
import com.chubb.claims.claim.entity.ClaimHistory;
import com.chubb.claims.claim.entity.ClaimHistory.Action;
import com.chubb.claims.claim.model.ClaimStatus;
import com.chubb.claims.claim.model.ClaimType;
import com.chubb.claims.claim.repository.ClaimHistoryRepository;
import com.chubb.claims.claim.repository.ClaimRepository;
import com.chubb.claims.claim.security.Caller;
import com.chubb.claims.common.exception.BusinessRuleException;
import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.chubb.claims.common.model.Market;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ClaimServiceTest {

    private static final Caller CLAIMANT = new Caller("claimant1", Set.of("CLAIMANT"));
    private static final Caller OFFICER = new Caller("officer1", Set.of("OFFICER"));
    private static final Caller MANAGER = new Caller("manager1", Set.of("MANAGER"));

    @Mock
    private ClaimRepository claims;
    @Mock
    private ClaimHistoryRepository history;
    @Mock
    private UserClient userClient;
    @InjectMocks
    private ClaimService service;

    private Claim claim(long id, ClaimStatus status, Long officerId) {
        Claim claim = new Claim(10L, "Aiko Tanaka", Market.JP, ClaimType.MOTOR, "Rear-ended",
                new BigDecimal("1500.00"), LocalDate.now().minusDays(2));
        ReflectionTestUtils.setField(claim, "id", id);
        if (officerId != null) {
            claim.assignTo(officerId, status);
        } else {
            claim.changeStatus(status);
        }
        return claim;
    }

    private UserSummary officer(long id, int capacity, boolean active) {
        return new UserSummary(id, "Officer " + id, "OFFICER", active, capacity, null, null);
    }

    private static CreateClaimRequest filing(Long claimantId, String claimantName, Market market, ClaimType type) {
        return new CreateClaimRequest(claimantId, claimantName, market, type, "Rear-ended",
                new BigDecimal("1500.00"), LocalDate.now());
    }

    // ---------------------------------------------------------------- create

    @Test
    void claimantCreatesClaimForOwnProfileAndHistoryIsRecorded() {
        CreateClaimRequest request = filing(999L, "Aiko Tanaka", Market.JP, ClaimType.MOTOR);
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        service.create(request, CLAIMANT);

        ArgumentCaptor<Claim> saved = ArgumentCaptor.forClass(Claim.class);
        verify(claims).save(saved.capture());
        assertThat(saved.getValue().getClaimantId()).isEqualTo(10L);          // body claimantId ignored
        assertThat(saved.getValue().getClaimantName()).isEqualTo("Aiko Tanaka");
        assertThat(saved.getValue().getMarket()).isEqualTo(Market.JP);        // snapshot of the claimant's market
        assertThat(saved.getValue().getStatus()).isEqualTo(ClaimStatus.OPEN);

        ArgumentCaptor<ClaimHistory> entry = ArgumentCaptor.forClass(ClaimHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getAction()).isEqualTo(Action.CREATED);
        assertThat(entry.getValue().getToStatus()).isEqualTo(ClaimStatus.OPEN);
        assertThat(entry.getValue().getChangedBy()).isEqualTo("claimant1");
    }

    @Test
    void officerFilingOnBehalfUsesTheClaimantsNameAndMarket() {
        CreateClaimRequest request = filing(2L, "Wei Lim", Market.SG, ClaimType.PROPERTY);
        when(userClient.getById(2L)).thenReturn(new UserSummary(2L, "Wei Lim", "CLAIMANT", true, 0, Market.SG, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        service.create(request, OFFICER);

        ArgumentCaptor<Claim> saved = ArgumentCaptor.forClass(Claim.class);
        verify(claims).save(saved.capture());
        assertThat(saved.getValue().getClaimantId()).isEqualTo(2L);
        assertThat(saved.getValue().getClaimantName()).isEqualTo("Wei Lim");
        assertThat(saved.getValue().getMarket()).isEqualTo(Market.SG);
        assertThat(saved.getValue().getClaimType()).isEqualTo(ClaimType.PROPERTY);
    }

    @Test
    void nameIsMatchedIgnoringCaseAndSpacesAndStoredAsInTheProfile() {
        CreateClaimRequest request = filing(null, "  mei CHEN ", Market.HK, ClaimType.MOTOR);
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(6L, "Mei Chen", "CLAIMANT", true, 0, Market.HK, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        service.create(request, CLAIMANT);

        ArgumentCaptor<Claim> saved = ArgumentCaptor.forClass(Claim.class);
        verify(claims).save(saved.capture());
        assertThat(saved.getValue().getClaimantName()).isEqualTo("Mei Chen");
    }

    @Test
    void marketThatDiffersFromTheClaimantsIsRejected() {
        CreateClaimRequest request = filing(null, "Mei Chen", Market.SG, ClaimType.MOTOR);
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(6L, "Mei Chen", "CLAIMANT", true, 0, Market.HK, null));

        assertThatThrownBy(() -> service.create(request, CLAIMANT)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Market SG does not match").hasMessageContaining("HK");
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void nameThatDiffersFromTheClaimantsIsRejected() {
        CreateClaimRequest request = filing(6L, "Someone Else", Market.HK, ClaimType.MOTOR);
        when(userClient.getById(6L)).thenReturn(new UserSummary(6L, "Mei Chen", "CLAIMANT", true, 0, Market.HK, null));

        assertThatThrownBy(() -> service.create(request, OFFICER)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Name 'Someone Else' does not match");
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void claimantWithoutAMarketFilesInTheMarketChosenOnTheClaim() {
        CreateClaimRequest request = filing(null, "Aiko Tanaka", Market.JP, ClaimType.MOTOR);
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "Aiko Tanaka", "CLAIMANT", true, 0, null, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        service.create(request, CLAIMANT);

        ArgumentCaptor<Claim> saved = ArgumentCaptor.forClass(Claim.class);
        verify(claims).save(saved.capture());
        assertThat(saved.getValue().getClaimantId()).isEqualTo(10L);
        assertThat(saved.getValue().getMarket()).isEqualTo(Market.JP);
    }

    // ------------------------------------------------------- policy number
    // The same table is in the frontend's shared/policy-number.spec.ts: change one, change both.

    @Test
    void policyNumberIsTheProfilesWhenThereIsOneOtherwiseMarketAndUserId() {
        UserSummary withPolicy = new UserSummary(1L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, "POL-JP-0001");
        UserSummary blank = new UserSummary(12L, "Nina Park", "CLAIMANT", true, 0, null, "  ");
        UserSummary none = new UserSummary(12L, "Nina Park", "CLAIMANT", true, 0, null, null);
        UserSummary bigId = new UserSummary(12345L, "Ola Wong", "CLAIMANT", true, 0, null, null);

        assertThat(ClaimService.policyNumberFor(withPolicy, Market.JP)).isEqualTo("POL-JP-0001");
        assertThat(ClaimService.policyNumberFor(withPolicy, Market.SG)).isEqualTo("POL-JP-0001");   // the profile wins
        assertThat(ClaimService.policyNumberFor(blank, Market.SG)).isEqualTo("POL-SG-0012");
        assertThat(ClaimService.policyNumberFor(none, Market.SG)).isEqualTo("POL-SG-0012");
        assertThat(ClaimService.policyNumberFor(none, Market.JP)).isEqualTo("POL-JP-0012");
        assertThat(ClaimService.policyNumberFor(bigId, Market.HK)).isEqualTo("POL-HK-12345");
    }

    @Test
    void claimIsStoredWithTheServersPolicyNumber() {
        CreateClaimRequest request = filing(null, "Nina Park", Market.SG, ClaimType.MOTOR);
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(12L, "Nina Park", "CLAIMANT", true, 0, null, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        Claim created = service.create(request, CLAIMANT);

        assertThat(created.getPolicyNumber()).isEqualTo("POL-SG-0012");
    }

    @Test
    void claimantsOwnPolicyNumberIsUsedOnTheClaim() {
        CreateClaimRequest request = filing(null, "Aiko Tanaka", Market.JP, ClaimType.MOTOR);
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(1L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, "POL-JP-0001"));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        assertThat(service.create(request, CLAIMANT).getPolicyNumber()).isEqualTo("POL-JP-0001");
    }

    @Test
    void staffFilingInTheirOwnNameGetAPolicyNumberFromTheirOwnId() {
        CreateClaimRequest request = filing(null, "Priya Nair", Market.SG, ClaimType.HEALTH);
        when(userClient.getByUsername("officer1"))
                .thenReturn(new UserSummary(13L, "Priya Nair", "OFFICER", true, 5, null, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        assertThat(service.create(request, OFFICER).getPolicyNumber()).isEqualTo("POL-SG-0013");
    }

    @Test
    void officerCannotFileOnBehalfOfANonClaimant() {
        CreateClaimRequest request = filing(3L, "Officer 3", Market.SG, ClaimType.HEALTH);
        when(userClient.getById(3L)).thenReturn(officer(3, 5, true));

        assertThatThrownBy(() -> service.create(request, OFFICER)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("not a claimant");
        verify(claims, never()).save(any(Claim.class));
    }

    @Test
    void officerWhoNamesNobodyFilesInTheirOwnName() {
        CreateClaimRequest request = filing(null, "Priya Nair", Market.SG, ClaimType.HEALTH);
        when(userClient.getByUsername("officer1"))
                .thenReturn(new UserSummary(3L, "Priya Nair", "OFFICER", true, 5, null, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        service.create(request, OFFICER);

        ArgumentCaptor<Claim> saved = ArgumentCaptor.forClass(Claim.class);
        verify(claims).save(saved.capture());
        assertThat(saved.getValue().getClaimantId()).isEqualTo(3L);
        assertThat(saved.getValue().getClaimantName()).isEqualTo("Priya Nair");
        assertThat(saved.getValue().getMarket()).isEqualTo(Market.SG);   // staff have no market: the one chosen stands
        verify(userClient, never()).getById(any(Long.class));
        ArgumentCaptor<ClaimHistory> entry = ArgumentCaptor.forClass(ClaimHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getChangedBy()).isEqualTo("officer1");
    }

    @Test
    void managerWhoNamesNobodyFilesInTheirOwnName() {
        CreateClaimRequest request = filing(null, "Maria Santos", Market.JP, ClaimType.TRAVEL);
        when(userClient.getByUsername("manager1"))
                .thenReturn(new UserSummary(5L, "Maria Santos", "MANAGER", true, 0, null, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        service.create(request, MANAGER);

        ArgumentCaptor<Claim> saved = ArgumentCaptor.forClass(Claim.class);
        verify(claims).save(saved.capture());
        assertThat(saved.getValue().getClaimantId()).isEqualTo(5L);
        assertThat(saved.getValue().getClaimantName()).isEqualTo("Maria Santos");
    }

    @Test
    void staffFilingInTheirOwnNameMustTypeTheirOwnName() {
        CreateClaimRequest request = filing(null, "Aiko Tanaka", Market.JP, ClaimType.HEALTH);
        when(userClient.getByUsername("officer1"))
                .thenReturn(new UserSummary(3L, "Priya Nair", "OFFICER", true, 5, null, null));

        assertThatThrownBy(() -> service.create(request, OFFICER)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Name 'Aiko Tanaka' does not match");
        verify(claims, never()).save(any(Claim.class));
    }

    // ---------------------------------------------------------------- read

    @Test
    void listForwardsMarketAndClaimTypeFilters() {
        Claim match = claim(1, ClaimStatus.OPEN, null);
        when(claims.search(null, null, null, Market.TH, ClaimType.PROPERTY)).thenReturn(List.of(match));

        assertThat(service.list(null, null, null, Market.TH, ClaimType.PROPERTY, MANAGER)).containsExactly(match);
    }

    @Test
    void claimantListIsAlwaysScopedToTheirOwnId() {
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "A", "CLAIMANT", true, 0, Market.JP, null));
        when(claims.search(null, 10L, null, Market.JP, null)).thenReturn(List.of());

        // the claimantId filter in the query string (99) is ignored for claimants
        assertThat(service.list(null, 99L, null, Market.JP, null, CLAIMANT)).isEmpty();
        verify(claims).search(null, 10L, null, Market.JP, null);
    }

    @Test
    void getUnknownClaimThrowsNotFound() {
        when(claims.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(5, MANAGER)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void claimantCannotViewSomeoneElsesClaim() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(77L, "A", "CLAIMANT", true, 0, Market.JP, null));

        assertThatThrownBy(() -> service.get(1, CLAIMANT)).isInstanceOf(AccessDeniedException.class);
    }

    // ---------------------------------------------------------------- assign

    @Test
    void assigningSubmittedClaimMovesItToAssignedAndLogsHistory() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));
        when(userClient.getById(2L)).thenReturn(officer(2, 5, true));
        when(claims.countOpenByOfficer(2)).thenReturn(1L);

        Claim result = service.assign(1, new AssignClaimRequest(2L, null), MANAGER);

        assertThat(result.getStatus()).isEqualTo(ClaimStatus.ASSIGNED);
        assertThat(result.getAssignedOfficerId()).isEqualTo(2L);
        ArgumentCaptor<ClaimHistory> entry = ArgumentCaptor.forClass(ClaimHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getAction()).isEqualTo(Action.ASSIGNED);
        assertThat(entry.getValue().getFromStatus()).isEqualTo(ClaimStatus.OPEN);
    }

    @Test
    void reassigningKeepsStatusAndLogsReassignment() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, 3L)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));
        when(userClient.getById(2L)).thenReturn(officer(2, 5, true));
        when(claims.countOpenByOfficer(2)).thenReturn(0L);

        Claim result = service.assign(1, new AssignClaimRequest(2L, "Specialist needed"), MANAGER);

        assertThat(result.getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.getAssignedOfficerId()).isEqualTo(2L);
        ArgumentCaptor<ClaimHistory> entry = ArgumentCaptor.forClass(ClaimHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getAction()).isEqualTo(Action.REASSIGNED);
        assertThat(entry.getValue().getRemarks()).isEqualTo("Specialist needed");
    }

    @Test
    void assignmentRejectedWhenOfficerAtCapacity() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(userClient.getById(2L)).thenReturn(officer(2, 3, true));
        when(claims.countOpenByOfficer(2)).thenReturn(3L);

        assertThatThrownBy(() -> service.assign(1, new AssignClaimRequest(2L, null), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("full capacity");
        verify(claims, never()).save(any(Claim.class));
    }

    @Test
    void assignmentRejectedWhenTargetIsNotOfficer() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(userClient.getById(1L)).thenReturn(new UserSummary(1L, "Aiko", "CLAIMANT", true, 0, Market.JP, null));

        assertThatThrownBy(() -> service.assign(1, new AssignClaimRequest(1L, null), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("not an officer");
    }

    @Test
    void assignmentRejectedForInactiveOfficer() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(userClient.getById(2L)).thenReturn(officer(2, 3, false));

        assertThatThrownBy(() -> service.assign(1, new AssignClaimRequest(2L, null), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("not active");
    }

    @Test
    void assignmentRejectedForFinalisedClaim() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.APPROVED, 2L)));

        assertThatThrownBy(() -> service.assign(1, new AssignClaimRequest(3L, null), MANAGER))
                .isInstanceOf(BusinessRuleException.class);
    }

    // ---------------------------------------------------------------- status

    @Test
    void assignedOfficerCanMoveClaimToUnderReview() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.ASSIGNED, 2L)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 5, true));

        StatusChange result = service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, "Started"),
                OFFICER);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.previousStatus()).isEqualTo(ClaimStatus.ASSIGNED);
        assertThat(result.entry().getAction()).isEqualTo(Action.STATUS_CHANGED);
        assertThat(result.entry().getFromStatus()).isEqualTo(ClaimStatus.ASSIGNED);
        assertThat(result.entry().getToStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.entry().getChangedBy()).isEqualTo("officer1");
        assertThat(result.entry().getRemarks()).isEqualTo("Started");
        verify(history).save(result.entry());   // the entry returned is the one that was stored
    }

    // ---------------------------------------------------------------- information requests

    @Test
    void assignedOfficerCanRequestInformationDuringReview() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, 2L)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 5, true));

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.ON_HOLD, "Please send the repair invoice"), OFFICER);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(result.previousStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.claim().getInfoRequest().message()).isEqualTo("Please send the repair invoice");
        assertThat(result.claim().getInfoRequest().requestedBy()).isEqualTo("officer1");
        assertThat(result.claim().getInfoRequest().requestedAt()).isNotNull();
        assertThat(result.entry().getAction()).isEqualTo(Action.INFO_REQUESTED);
        assertThat(result.entry().getFromStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.entry().getToStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(result.entry().getRemarks()).isEqualTo("Please send the repair invoice");
    }

    @Test
    void managerCanRequestInformationOnAnyClaimUnderReview() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, 2L)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.ON_HOLD, "Please send the police report"), MANAGER);

        assertThat(result.claim().getInfoRequest().requestedBy()).isEqualTo("manager1");
        assertThat(result.entry().getAction()).isEqualTo(Action.INFO_REQUESTED);
    }

    @Test
    void requestingInformationNeedsRemarksSayingWhatIsNeeded() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, 2L)));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.ON_HOLD, "  "),
                MANAGER)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Remarks are mandatory when requesting information");
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void informationCanOnlyBeRequestedDuringReview() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.ASSIGNED, 2L)));

        assertThatThrownBy(() -> service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.ON_HOLD, "Please send the invoice"), MANAGER))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Cannot move claim from ASSIGNED to ON_HOLD");
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void staffCannotResumeOrDecideAClaimThatIsWaitingForTheClaimant() {
        Claim held = claim(1, ClaimStatus.UNDER_REVIEW, 2L);
        held.requestInformation("Please send the repair invoice", "officer1");
        when(claims.findById(1L)).thenReturn(Optional.of(held));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 5, true));

        for (Caller staff : List.of(OFFICER, MANAGER)) {
            for (ClaimStatus target : List.of(ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED, ClaimStatus.REJECTED,
                    ClaimStatus.SETTLED, ClaimStatus.ON_HOLD)) {
                assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(target, "Going ahead"), staff))
                        .as("%s moving a held claim to %s", staff.username(), target)
                        .isInstanceOf(BusinessRuleException.class).hasMessageContaining("on hold");
            }
        }
        assertThat(held.getStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(held.getInfoRequest()).isNotNull();                      // the request is still open
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void staffCanStillCloseAClaimThatIsWaitingForTheClaimant() {
        Claim held = claim(1, ClaimStatus.UNDER_REVIEW, 2L);
        held.requestInformation("Please send the repair invoice", "officer1");
        when(claims.findById(1L)).thenReturn(Optional.of(held));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.CLOSED, "Withdrawn, the claimant never replied"), MANAGER);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.CLOSED);
        assertThat(result.previousStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(result.entry().getAction()).isEqualTo(Action.STATUS_CHANGED);
        assertThat(result.entry().getToStatus()).isEqualTo(ClaimStatus.CLOSED);
    }

    @Test
    void claimantReplyResumesReviewAndIsLoggedInTheHistory() {
        Claim waiting = claim(1, ClaimStatus.UNDER_REVIEW, 2L);
        waiting.requestInformation("Please send the repair invoice", "officer1");
        when(claims.findById(1L)).thenReturn(Optional.of(waiting));
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, null));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, "Invoice INV-77 attached"), CLAIMANT);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.previousStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(result.claim().getInfoRequest()).isNull();                       // no longer open
        assertThat(result.claim().getLastReply().message()).isEqualTo("Invoice INV-77 attached");
        assertThat(result.claim().getLastReply().repliedBy()).isEqualTo("claimant1");
        assertThat(result.claim().getLastReply().repliedAt()).isNotNull();
        ArgumentCaptor<ClaimHistory> entry = ArgumentCaptor.forClass(ClaimHistory.class);
        verify(history).save(entry.capture());
        assertThat(result.entry()).isSameAs(entry.getValue());
        assertThat(entry.getValue().getAction()).isEqualTo(Action.INFO_PROVIDED);
        assertThat(entry.getValue().getFromStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(entry.getValue().getToStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(entry.getValue().getChangedBy()).isEqualTo("claimant1");
        assertThat(entry.getValue().getRemarks()).isEqualTo("Invoice INV-77 attached");
        verify(claims, never()).countOpenByOfficer(anyLong());   // the claimant never goes through officer pick-up
    }

    @Test
    void replyIsRejectedWhenNothingWasRequested() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, 2L)));
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, null));

        assertThatThrownBy(() -> service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, "Here it is"), CLAIMANT))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("No information has been requested").hasMessageContaining("UNDER_REVIEW");
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void anotherClaimantCannotReplyOnSomeoneElsesClaim() {
        Claim waiting = claim(1, ClaimStatus.UNDER_REVIEW, 2L);
        waiting.requestInformation("Please send the repair invoice", "officer1");
        when(claims.findById(1L)).thenReturn(Optional.of(waiting));
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(77L, "Someone Else", "CLAIMANT", true, 0, Market.SG, null));

        assertThatThrownBy(() -> service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, "Here it is"), CLAIMANT))
                .isInstanceOf(AccessDeniedException.class);
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void claimantReplyNeedsRemarksSayingWhatIsProvided() {
        Claim waiting = claim(1, ClaimStatus.UNDER_REVIEW, 2L);
        waiting.requestInformation("Please send the repair invoice", "officer1");
        when(claims.findById(1L)).thenReturn(Optional.of(waiting));
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, null));

        for (String remarks : new String[] {null, "", "   "}) {
            assertThatThrownBy(() -> service.updateStatus(1,
                    new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, remarks), CLAIMANT))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Remarks are mandatory when answering an information request");
        }
        assertThat(waiting.getStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void claimantCanOnlyAnswerAnInformationRequestNotMakeAnyOtherStatusChange() {
        Claim waiting = claim(1, ClaimStatus.UNDER_REVIEW, 2L);
        waiting.requestInformation("Please send the repair invoice", "officer1");
        when(claims.findById(1L)).thenReturn(Optional.of(waiting));
        when(userClient.getByUsername("claimant1"))
                .thenReturn(new UserSummary(10L, "Aiko Tanaka", "CLAIMANT", true, 0, Market.JP, null));

        for (ClaimStatus target : List.of(ClaimStatus.APPROVED, ClaimStatus.REJECTED, ClaimStatus.CLOSED,
                ClaimStatus.ON_HOLD, ClaimStatus.ASSIGNED)) {
            assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(target, "Please approve"),
                    CLAIMANT)).as("claimant asking for %s", target).isInstanceOf(AccessDeniedException.class);
        }
        assertThat(waiting.getStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void officerCannotUpdateClaimAssignedToSomeoneElse() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.ASSIGNED, 9L)));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 5, true));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, null), OFFICER))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void officerCanPickUpUnassignedClaimAndMoveItToUnderReview() {
        Claim submitted = claim(1, ClaimStatus.OPEN, null);
        when(claims.findById(1L)).thenReturn(Optional.of(submitted));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 5, true));
        when(claims.countOpenByOfficer(2L)).thenReturn(1L);

        StatusChange result = service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, null), OFFICER);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.claim().getAssignedOfficerId()).isEqualTo(2L);
        // what the caller saw before the request, although the pick-up moved it to ASSIGNED on the way
        assertThat(result.previousStatus()).isEqualTo(ClaimStatus.OPEN);
        assertThat(result.entry().getFromStatus()).isEqualTo(ClaimStatus.ASSIGNED);
        verify(history, org.mockito.Mockito.times(2)).save(any(ClaimHistory.class));
    }

    @Test
    void officerAtFullCapacityCannotPickUpUnassignedClaim() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 1, true));
        when(claims.countOpenByOfficer(2L)).thenReturn(1L);

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, null), OFFICER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("full capacity");
    }

    @Test
    void managerCanStartReviewingAnOpenClaimWithoutAssigningAnOfficer() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.UNDER_REVIEW, "Reviewing this one myself"), MANAGER);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.claim().getAssignedOfficerId()).isNull();   // nobody is assigned, and nobody needs to be
        assertThat(result.previousStatus()).isEqualTo(ClaimStatus.OPEN);
        assertThat(result.entry().getAction()).isEqualTo(Action.STATUS_CHANGED);
        assertThat(result.entry().getFromStatus()).isEqualTo(ClaimStatus.OPEN);
        assertThat(result.entry().getToStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
        assertThat(result.entry().getChangedBy()).isEqualTo("manager1");
        org.mockito.Mockito.verifyNoInteractions(userClient);   // no officer is looked up, so no capacity is used
        verify(history, org.mockito.Mockito.times(1)).save(any(ClaimHistory.class));
    }

    @Test
    void managerCanTakeAClaimThroughTheWholeWorkflowWithoutEverAssigningAnOfficer() {
        Claim open = claim(1, ClaimStatus.OPEN, null);
        when(claims.findById(1L)).thenReturn(Optional.of(open));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        for (ClaimStatus step : List.of(ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED, ClaimStatus.SETTLED,
                ClaimStatus.CLOSED)) {
            service.updateStatus(1, new UpdateStatusRequest(step, null), MANAGER);
            assertThat(open.getStatus()).isEqualTo(step);
        }

        assertThat(open.getAssignedOfficerId()).isNull();
        org.mockito.Mockito.verifyNoInteractions(userClient);
    }

    @Test
    void managerRejectingAClaimItIsReviewingItselfMustSayWhy() {
        Claim reviewing = claim(1, ClaimStatus.UNDER_REVIEW, null);
        when(claims.findById(1L)).thenReturn(Optional.of(reviewing));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.REJECTED, " "), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("Remarks are mandatory");

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.REJECTED, "Outside the policy period"), MANAGER);
        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.REJECTED);
        assertThat(result.claim().getAssignedOfficerId()).isNull();
    }

    @Test
    void managerCanRequestInformationOnAClaimItIsReviewingItself() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, null)));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));

        StatusChange result = service.updateStatus(1,
                new UpdateStatusRequest(ClaimStatus.ON_HOLD, "Please send the repair estimate"), MANAGER);

        assertThat(result.claim().getStatus()).isEqualTo(ClaimStatus.ON_HOLD);
        assertThat(result.claim().getInfoRequest().requestedBy()).isEqualTo("manager1");
        assertThat(result.claim().getAssignedOfficerId()).isNull();
        assertThat(result.entry().getAction()).isEqualTo(Action.INFO_REQUESTED);
    }

    @Test
    void anOfficerCannotTakeOverAClaimTheManagerIsHandlingDirectly() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, null)));
        when(userClient.getByUsername("officer1")).thenReturn(officer(2, 5, true));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.APPROVED, null), OFFICER))
                .isInstanceOf(AccessDeniedException.class).hasMessageContaining("not assigned to you");
        verify(claims, never()).save(any(Claim.class));
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void managerCanHandAClaimUnderDirectReviewToAnOfficerLater() {
        Claim reviewing = claim(1, ClaimStatus.UNDER_REVIEW, null);
        when(claims.findById(1L)).thenReturn(Optional.of(reviewing));
        when(claims.save(any(Claim.class))).thenAnswer(call -> call.getArgument(0));
        when(userClient.getById(2L)).thenReturn(officer(2, 5, true));
        when(claims.countOpenByOfficer(2L)).thenReturn(0L);

        Claim result = service.assign(1, new AssignClaimRequest(2L, null), MANAGER);

        assertThat(result.getAssignedOfficerId()).isEqualTo(2L);
        assertThat(result.getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);   // the review carries on where it was
        ArgumentCaptor<ClaimHistory> entry = ArgumentCaptor.forClass(ClaimHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getAction()).isEqualTo(Action.ASSIGNED);   // a first assignment, not a reassignment
    }

    @Test
    void illegalTransitionIsRejected() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.ASSIGNED, 2L)));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.APPROVED, null), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("Cannot move claim");
        verify(history, never()).save(any(ClaimHistory.class));
    }

    @Test
    void rejectionRequiresRemarks() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.UNDER_REVIEW, 2L)));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.REJECTED, "  "), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("Remarks are mandatory");
    }

    @Test
    void assignedStatusMustGoThroughAssignmentEndpoint() {
        when(claims.findById(1L)).thenReturn(Optional.of(claim(1, ClaimStatus.OPEN, null)));

        assertThatThrownBy(() -> service.updateStatus(1, new UpdateStatusRequest(ClaimStatus.ASSIGNED, null), MANAGER))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("assignment endpoint");
    }
}
