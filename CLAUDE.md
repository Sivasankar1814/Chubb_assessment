# CLAUDE.md

Guidance for Claude Code (and other contributors) working in this repository.

## Project

Chubb APAC Claims Management System – Java 21, Spring Boot 3.3.5, Spring Cloud 2023.0.3, Maven multi-module.
See `README.md` for architecture, users, API walkthrough and run instructions.

## Modules and ports

| Module | Port | Package root |
|--------|------|--------------|
| api-gateway (reactive, no `common`) | 8080 | `com.chubb.claims.gateway` |
| user-service (all users + login) | 8081 | `com.chubb.claims.user` |
| claim-service | 8083 | `com.chubb.claims.claim` |
| workload-service (stateless, no DB) | 8084 | `com.chubb.claims.workload` |
| common (plain jar, auto-configuration) | – | `com.chubb.claims.common` |

## Demo users and ids

Created by `user-service`'s `DemoDataSeeder` when the users table is empty. All users share **one id list**, in seed order:

| Username | Password | Role | User id |
|----------|----------|------|---------|
| `claimant1` | `claimant123` | CLAIMANT | 1 (Aiko Tanaka) |
| `claimant2` | `claimant123` | CLAIMANT | 2 (Wei Lim) |
| `officer1` | `officer123` | OFFICER | 3 (Priya Nair, capacity 5) |
| `officer2` | `officer123` | OFFICER | 4 (Daniel Chen, capacity 8) |
| `manager1` | `manager123` | MANAGER | 5 (Maria Santos) |

* A claim's `claimantId` and `assignedOfficerId` are **user ids**. `assignedOfficerId` must belong to an OFFICER user (3 or 4);
  assigning 1 or 5 fails with 409 "User … is not an officer". Only `officer1` and `officer2` exist (no `officer3`/`officer4`).
* Logins are by username, never by id. Data is in-memory H2, so users, claims and ids reset on every restart.

## Authentication flow

* `POST /api/auth/login` (public, through the gateway on :8080) returns a JWT (default 120 minutes). Send it as
  `Authorization: Bearer <token>`. `common`'s `SecurityConfig` validates it; only `user-service` signs tokens.
* Swagger UI (http://localhost:8080/swagger-ui.html): pick **user-service**, run the login, click **Authorize**, paste the
  token without `Bearer `. The login is remembered across reloads (`springdoc.swagger-ui.persist-authorization` in
  `api-gateway/src/main/resources/application.yml`); click **Logout** in the dialog before switching user.
* Status codes: **401** no/invalid/expired token or bad login; **403** role not allowed or not your resource;
  **409** business rule broken (illegal status move, assignee not an officer, officer at full capacity); **400** validation.

## Commands

```bash
./mvnw clean install                       # build + all tests (mvnw.cmd on Windows)
./mvnw -pl claim-service -am test          # one module (+ common)
./mvnw -pl claim-service test -Dtest=ClaimServiceTest
./mvnw -pl <module> spring-boot:run        # run a service
```

Needs JDK 21 (`JAVA_HOME`). `scripts/start-all.ps1` builds and launches everything on Windows.

## Running locally (Windows)

* Health: `GET /actuator/health` on 8080, 8081, 8083 and 8084 must all return 200.
* Stop everything with `Get-Process java | Stop-Process -Force`, then start **exactly one** set of the four jars
  (`user-service`, `claim-service`, `workload-service`, `api-gateway`). A double start leaves two sets of Java processes:
  check the process count.
* Running jars lock their files, so stop services before rebuilding. Spring Boot fat jars are not repackaged when only a
  dependency (`common`) changed: use `./mvnw clean install` after editing `common`.
* Services started hidden write to `%TEMP%\cms-logs\<service>.out.log` / `.err.log` when launched with redirected output.

## Architecture rules

* **Layering:** `controller` (HTTP, validation, `@PreAuthorize`) → `service` (business rules, transactions) →
  `repository` (Spring Data JPA interfaces over `@Entity` classes). Controllers never touch repositories.
* **Database per service.** Never query another service's tables; call it through its Feign client.
  Tables are generated from the `entity` classes (`spring.jpa.hibernate.ddl-auto=update`); `user-service`'s
  `DemoDataSeeder` creates the demo users (BCrypt-hashed) when the users table is empty. Keep entities
  H2-in-MySQL-mode and MySQL compatible: no vendor-specific column types or queries.
  Default is in-memory H2; `application-mysql.yml` switches to MySQL (`--spring.profiles.active=mysql`).
* **Shared cross-cutting code lives in `common`** and is wired by
  `META-INF/spring/...AutoConfiguration.imports` → `CommonAutoConfiguration`. Do not copy security,
  exception-handling or OpenAPI config into services.
  * `SecurityConfig`: stateless JWT bearer validation (HS256, shared secret from `JwtProperties`; roles come from the token's `roles` claim), `@EnableMethodSecurity`. Only `user-service` knows passwords and signs tokens (`TokenService`).
  * `GlobalExceptionHandler`: the only place exceptions become HTTP responses (`ApiError` payload).
  * `FeignConfig`: forwards the `Authorization` header to downstream calls and maps downstream 404 →
    `ResourceNotFoundException`.
* **Exceptions:** throw `ResourceNotFoundException` (404) or `BusinessRuleException` (409) from services;
  Spring Security's `AccessDeniedException` → 403. Add new mappings in `GlobalExceptionHandler`, not per controller.
* **Feign clients** live in `<service>.client`, are enabled by a dedicated `FeignClientsConfig` (not the
  `@SpringBootApplication` class, so `@WebMvcTest`/`@DataJpaTest` slices don't try to create them), and declare small
  `record` views of only the fields they need. `claim-service` and `workload-service` each have one `UserClient`
  calling `user-service`.
* **Security:** roles are `CLAIMANT`, `OFFICER`, `MANAGER`. Use `@PreAuthorize("hasRole(..)")` for role gates; ownership
  rules (claimant sees only their own data, officers only update claims assigned to them) belong in the service layer.
  `claim-service` passes a framework-free `Caller` record into services to keep them unit-testable.
* **Claim workflow** is defined once in `ClaimStatus.canTransitionTo`. Every state change must write a
  `claim_history` row (`ClaimService.record`, saved through `ClaimHistoryRepository`). `ASSIGNED` is only set by the assignment operation, or when OFFICERS pick up an unassigned `OPEN` claim by updating its status (`ClaimService.claimForOfficer`: self-assigns, capacity-checked, history row written). A claim assigned to another officer still gives 403 "Claim is not assigned to you".
* **Workload** = claims in `ASSIGNED`/`UNDER_REVIEW`. Defined once in `ClaimStatus.IN_PROGRESS` and used by the repository
  count queries.
* DTOs are Java `record`s with Jakarta Validation annotations; entities are JPA `@Entity` classes (private fields, getters, no setters; state changes go through intention-revealing methods such as `Claim.assignTo`) in each service's `entity` package. Cross-service references (`claimantId`, `assignedOfficerId`) are plain columns, never joins.
  New endpoints need a Swagger `@Operation(summary = ..)`.

## Testing conventions

* JUnit 5 + Mockito (`@ExtendWith(MockitoExtension.class)`) for services; AssertJ assertions.
* `@WebMvcTest` + `@Import(CommonAutoConfiguration.class)` + `@MockBean` service for controller security/validation
  (use `jwt().jwt(t -> t.subject("user")).authorities(new SimpleGrantedAuthority("ROLE_OFFICER"))` instead of real tokens).
* `@DataJpaTest` for repositories (Hibernate creates the schema on embedded H2).
* `@SpringBootTest` + `@AutoConfigureMockMvc` for full flows, e.g. `AuthFlowIntegrationTest` in `user-service`
  (real login, real token, real filter chain, seeded demo users).
* Add or update tests with every behaviour change; `./mvnw clean install` must stay green.

## Working agreements

* For multi-file or behaviour-changing work, plan first (plan mode), update this file, then implement.
* Keep CLAUDE.md in sync in the same change: stale facts here mislead the next session.
* Before calling work done: `./mvnw clean install` passes and a live check through the gateway (login, then the
  affected endpoints) behaves as documented.

## Conventions

* Package-by-layer inside each service (`controller`, `service`, `repository`, `entity`, `dto`, `client`; claim-service keeps its enums in `model`).
* Constructor injection only; no Lombok.
* Keep comments for non-obvious *why*; follow the surrounding code's style.
* Don't commit `target/`; demo credentials are for local use only.

## Known simplifications

* One `users` table in `user-service` holds claimants, officers and managers (single `User` entity; the role decides which profile columns apply). No refresh tokens / token revocation / self-service password change.
* The JWT secret has a built-in demo default; every service must share the same `CHUBB_SECURITY_JWT_SECRET` outside local use.
* No service discovery: services and the gateway call each other at fixed URLs (`services.<name>.url`, defaulting to localhost:8081-8084).
