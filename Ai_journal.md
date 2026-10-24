# AI-Assisted Development Journal

**Project:** Chubb APAC Claims Management System
**Tool:** Claude Code (CLI), used throughout design, implementation, debugging and documentation
**Purpose of this document:** an honest account of how AI was used to build the system, where it helped, where it needed
correction, and how its output was checked. Prompts are paraphrased and grouped by phase.

**Terminology:** the role now called *officer* was called *staff* until phase 4. Prompts quoted below keep the word that
was used at the time; descriptions of the current system say *officer*.

## 1. Summary

| | |
|---|---|
| **Delivered** | Five-module Maven build: reactive API gateway (8080, no `common`), `user-service` (8081), `claim-service` (8083), stateless `workload-service` (8084, no DB) and a shared `common` library. Java 21, Spring Boot 3.3.5, Spring Cloud 2023.0.3 (Gateway, OpenFeign), Spring Security with JWT, JPA on in-memory H2 by default or MySQL (`--spring.profiles.active=mysql`), Swagger UI. |
| **Business scope** | Claim submission, assignment to officers, a status workflow with an audit trail, role-based access for claimants, officers and managers, and an officer workload calculation. |
| **How AI was used** | Scaffolding and implementation from a written brief, then iterative debugging and behaviour changes driven by short, concrete prompts. |
| **How it was kept in check** | A standing rules file (`CLAUDE.md`) the AI reads each session, plan-first for multi-file changes, automated tests with every behaviour change, and a live end-to-end check through the gateway. |

## 2. How the work was run

- **Brief first.** One detailed prompt set the stack, services, security model and deliverables (section 3).
- **Persistent rules.** `CLAUDE.md` records the modules and ports, demo users, architecture rules, testing conventions,
  working agreements and "known simplifications", so each session starts from the same constraints instead of
  re-deriving them.
- **Plan before multi-file changes.** Working agreement: for multi-file or behaviour-changing work, plan first (plan
  mode), update `CLAUDE.md`, then implement, and keep `CLAUDE.md` in sync in the same change.
- **Definition of done.** `./mvnw clean install` passes, and a live check through the gateway (login, then the affected
  endpoints) behaves as documented.
- **Specific prompts.** Naming the endpoint, the user, the exact message seen and how to prove the fix gave the fastest
  diagnosis.
- **Verify, don't trust.** Behaviour was confirmed against the running system, not only against the code (section 8).

## 3. Phase 1: Initial brief

The brief, stated as the system was built and as `CLAUDE.md` describes it (the table below lists where this departs from
the original wording):

> A Claims Management System for Chubb APAC in Java 21, Spring Boot 3.3.5 and Spring Cloud 2023.0.3, as a Maven
> multi-module build. A reactive Spring Cloud Gateway (8080) fronts three services: `user-service` (8081; claimants,
> officers and managers, plus login), `claim-service` (8083) and a stateless `workload-service` (8084, no database). A
> shared `common` library holds security, exception handling, Feign and OpenAPI configuration. There is no service
> discovery; services call each other at fixed URLs through OpenFeign. Spring Security with username/password login
> that issues a stateless JWT (HS256, 120 minutes by default) and role-based authorization for `CLAIMANT`, `OFFICER` and
> `MANAGER`. JPA on in-memory H2 by default or MySQL, one database per service. Springdoc Swagger UI on the gateway.
> Claim creation, retrieval, assignment to officers, a status workflow with a `claim_history` row for every state
> change, officer workload (claims in `ASSIGNED` or `UNDER_REVIEW`) against capacity, validation, centralized exception
> handling, JUnit 5 + Mockito tests, and `CLAUDE.md`, `README.md`, `architecture.md` and `test-payloads.json`.

**Outcome:** Maven multi-module project (`common`, gateway and domain services), layered code
(controller → service → repository), global exception handler, claim state machine, history audit, tests, docs.

### Where the result differs from the brief

| Original brief | Built | Consequence |
|----------------|-------|-------------|
| Separate Claimant and Staff services | One `user-service` for all roles; the role decides which profile fields apply | One login and one place for roles and officer capacity; the `users` table has role-specific nullable columns |
| Username/password security | Username/password login that issues a JWT (see phase 3) | Stateless; see limitations in section 9 |

## 4. Phase 2: Running and operating the system

- "Stop every Java process, rebuild all modules with `./mvnw clean install`, then start exactly one set of the four
  services (user, claim, workload, gateway) with output redirected to `%TEMP%\cms-logs`. Don't report success until
  `/actuator/health` returns 200 on 8080, 8081, 8083 and 8084 and the Java process count shows no double start."
  (repeated after almost every code change)
- "List every demo user with username, password, role and user id in seed order, and say which ids are valid as
  `assignedOfficerId` and what status code and message the others return."
- "Walk through the claimant journey through the gateway on :8080 as runnable steps: log in for a JWT, submit a claim,
  read it back, and show the 403 when a claimant requests another claimant's claim. Give both the curl commands and
  the Swagger UI steps (Authorize with the token, without the `Bearer ` prefix)."
- "For each service that owns a database, give the H2 console URL, JDBC URL and credentials, and confirm that
  `workload-service` has no database."

**Outcome:** a repeatable Windows start/stop procedure (`scripts/start-all.ps1`; exactly one set of four jars, health
checks on 8080/8081/8083/8084, logs of hidden services in `%TEMP%\cms-logs`), a demo-user table, H2 console URLs, and curl
and Swagger walkthroughs in the README.

## 5. Phase 3: Debugging

| Prompt (paraphrased) | Finding | Change |
|----------------------|---------|--------|
| "`/api/claims/2/assignment` through the gateway answers 'validation failed'. Reproduce it with curl as `manager1` and as a non-manager, show the exact request body the endpoint accepts and which role may call it, and tell me whether this is a bug or a caller error before changing any code." | Request body and role requirements were not clear to the caller | Explained the body and the manager-only rule |
| "The gateway's Swagger entry URLs return the Spring whitelabel error page. Find which of them have no handler, make them all land on `/swagger-ui.html`, and prove each one with curl following redirects." | The gateway had no handler for the common entry URLs | Gateway redirects them to `/swagger-ui.html` |
| "In the aggregated Swagger UI the server URL for each service shows `localhost:8083` instead of the gateway on 8080, so Try it out bypasses the gateway. Find out why and fix it at the gateway for every docs route." | Aggregated docs advertised the downstream port | `PreserveHostHeader` on the docs routes |
| "After a successful login, Swagger and the browser still report 'authorization required' / 401. Reproduce with curl first, then a headless browser, and tell me which layer is at fault (server, token or client state) before touching code." (reported repeatedly) | HTTP Basic auth was the source: its pop-ups and Swagger's fragile Authorize state, not the server, were the cause | Replaced Basic auth with a stateless JWT (HS256, 120 minutes by default) signed only by `user-service`, validated locally by `user-service`, `claim-service` and `workload-service` through `common` (the gateway only routes). Swagger's login is remembered across reloads (`persist-authorization`) |
| "Assigning a claim to user 1 fails with 'User Aiko Tanaka is not a staff member'. Before treating it as a bug, check the seeded ids and roles and tell me which ids are valid assignees." | Not a bug: user ids are shared across roles, staff (now officer) ids are 3 and 4 | None; clarified in the docs |

## 6. Phase 4: Behaviour changes

- "Staff should be able to process a claim even if the manager has not assigned it; implement 'Claim is not assigned to
  you'" → an officer's status update on an unassigned claim picks it up (capacity-checked, history row written); a claim
  assigned to another officer still returns 403 "Claim is not assigned to you".
- "When claim is submitted, status should be open" → status `SUBMITTED` renamed to `OPEN` everywhere.
- "Instead of staff can you please change as officer" → the role `STAFF` became `OFFICER` across code, API, demo data,
  tests and docs. Handled plan-first because it is a breaking API change: scope was confirmed (full rename rather than
  wording only), `CLAUDE.md` was updated first, then a mechanical case-preserving replace followed by a manual pass for
  articles and plurals ("a staff member" → "an officer"). Renamed: token role, `staffId` → `officerId`,
  `assignedStaffId` → `assignedOfficerId`, `/stats/open-by-staff` → `/stats/open-by-officer`, `StaffWorkload` →
  `OfficerWorkload`, demo users `staff1`/`staff2` → `officer1`/`officer2`. Existing MySQL data needs a one-off
  migration, documented in `architecture.md`.

## 7. Phase 5: Documentation

- `README.md`: architecture, demo users, API walkthrough, run instructions.
- `CLAUDE.md`: rules for working in the repo, kept in sync with each change.
- `test-payloads.json`: sample request bodies, including negative cases.
- `architecture.md`: design write-up generated from reading the source: component and sequence diagrams, security
  model, data ownership, claim lifecycle, trade-offs and known limitations.
- This journal.

## 8. How AI output was verified

- **Automated tests** (JUnit 5, Mockito, AssertJ): claim state machine, claim service rules, repositories on H2
  (`@DataJpaTest`), user and auth services, controller security and validation (`@WebMvcTest` with a mocked JWT), and a
  full login-to-token flow (`AuthFlowIntegrationTest`, `@SpringBootTest`). Tests are added or updated with every
  behaviour change, and `./mvnw clean install` must stay green.
- **Live check:** `/actuator/health` returns 200 on 8080, 8081, 8083 and 8084, then a login through the gateway and the
  affected endpoints. For example, `GET /api/workload` as a manager crosses services and exercises the gateway,
  workload, user and claim services together.
- **Process hygiene:** after every start, count the Java processes to catch a double start.
- **Auth problems:** reproduce with a raw HTTP client first, then the browser, to separate server bugs from client
  state.
- **Review of the finished system:** `architecture.md` was produced by reading the code rather than the README, which
  surfaced the limitations in section 9.

## 9. Known limitations (identified in review)

These are acceptable for a local demo and would be addressed before production:

- **Capacity check is not atomic.** Assignment counts open claims and then saves, with no locking, so two simultaneous
  assignments can exceed an officer's capacity.
- **No referential integrity across services.** Deleting a user does not check the claims that reference them.
- **Default JWT secret and open H2 console.** The secret has a demo default in source (every service must share the same
  `CHUBB_SECURITY_JWT_SECRET` outside local use), and `/h2-console/**` is on the public path list of every service that
  uses `common`.
- **No resilience layer.** No retries, circuit breakers or explicit Feign timeouts.
- **No token revocation, refresh tokens or self-service password change.**
- **No service discovery.** Services and the gateway call each other at fixed URLs (`services.<name>.url`, defaulting to
  localhost:8081-8084).
- **One `users` table** holds claimants, officers and managers; the role decides which profile columns apply.
- **Data resets on restart.** The default database is in-memory H2, so users, claims and ids are recreated by the demo
  data seeder every time.
- **Schema comes from `ddl-auto=update`**, with no migration tool.

Suggested next steps: optimistic locking on claims, an identity provider with asymmetric token validation, service
discovery, and retries and circuit breakers on Feign calls.

## 10. Lessons learned

- Spring Boot fat jars are not repackaged when only `common` changes: use `./mvnw clean install`.
- Stop all Java processes before rebuilding (locked jars) and check the process count after a start (double starts).
  Where `java` resolves to the Oracle launcher stub, each service shows as two processes, so 4 services means 8.
- Verify auth problems with a raw HTTP client first, then the browser, to separate server bugs from client state.
- Specific prompts that name the endpoint, user and observed message ("/api/claims/{id}/assignment ... User
  Aiko Tanaka is not a staff member") and say how the fix should be proven were the quickest to diagnose.
- Always check ids before blaming code: all users share one id list and the ids reset on every restart, so
  `assignedOfficerId` must be 3 or 4 and assigning 1 or 5 fails with 409.
- Read the status code before the message: 401 is a missing, invalid or expired token or a bad login, 403 a role that is
  not allowed or a resource that is not yours, 409 a broken business rule, 400 validation.
- Keep the AI's context in the repo (`CLAUDE.md`), not in the conversation: it carried rules and decisions across
  sessions.
- Read the code, not just the README, before describing a system: the documentation and the implementation can drift.

## 11. Related files

- `README.md`: architecture, users, API walkthrough
- `architecture.md`: design, security, data ownership, trade-offs, limitations
- `CLAUDE.md`: rules for working in this repo
- `test-payloads.json`: sample request bodies, including negative cases
- `scripts/start-all.ps1`: builds and launches all four services on Windows
