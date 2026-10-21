package com.chubb.claims.workload.controller;

import com.chubb.claims.workload.model.StaffWorkload;
import com.chubb.claims.workload.service.WorkloadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workload")
@Tag(name = "Workload", description = "Staff workload calculation")
public class WorkloadController {

    private final WorkloadService service;

    public WorkloadController(WorkloadService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('STAFF','MANAGER')")
    @Operation(summary = "Workload of all active staff, least utilised first")
    public List<StaffWorkload> all() {
        return service.getAll();
    }

    @GetMapping("/suggestion")
    @PreAuthorize("hasRole('MANAGER')")
    @Operation(summary = "Suggest the best staff member for the next claim (manager)")
    public StaffWorkload suggestion() {
        return service.suggestAssignee();
    }

    @GetMapping("/{staffId}")
    @PreAuthorize("hasAnyRole('STAFF','MANAGER')")
    @Operation(summary = "Workload of a single staff member")
    public StaffWorkload forStaff(@PathVariable long staffId) {
        return service.getForStaff(staffId);
    }
}
