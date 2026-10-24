package com.chubb.claims.workload.controller;

import com.chubb.claims.workload.model.OfficerWorkload;
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
@Tag(name = "Workload", description = "Officer workload calculation")
public class WorkloadController {

    private final WorkloadService service;

    public WorkloadController(WorkloadService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OFFICER','MANAGER')")
    @Operation(summary = "Workload of all active officers, least utilised first")
    public List<OfficerWorkload> all() {
        return service.getAll();
    }

    @GetMapping("/suggestion")
    @PreAuthorize("hasRole('MANAGER')")
    @Operation(summary = "Suggest the best officer for the next claim (manager)")
    public OfficerWorkload suggestion() {
        return service.suggestAssignee();
    }

    @GetMapping("/{officerId}")
    @PreAuthorize("hasAnyRole('OFFICER','MANAGER')")
    @Operation(summary = "Workload of a single officer")
    public OfficerWorkload forOfficer(@PathVariable long officerId) {
        return service.getForOfficer(officerId);
    }
}
