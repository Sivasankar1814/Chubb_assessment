# Architecture – Chubb APAC Backend Claim Management

How the system is put together and why. For setup, configuration, demo users and an API walkthrough see
[README.md](README.md); for the rules to follow when changing code see [CLAUDE.md](CLAUDE.md).

The pictures are in `docs/` (SVG, each with a 2x PNG export; the technology-stack banner is in the README). The remaining
diagrams use [Mermaid](https://mermaid.js.org/), which GitHub renders inline.

## 1. Overview

A small microservice system for filing, assigning and tracking insurance claims. Four deployable Spring Boot
applications share one Maven build and one library:

* Java 21, Spring Boot 3.3.5, Spring Cloud 2023.0.3 (Gateway, OpenFeign), Spring Security (JWT resource server),
  Spring Data JPA, springdoc-openapi 2.6.0.
* **Synchronous REST only.** No message broker, no service registry, no shared database.
* **Stateless services.** Identity travels in a signed JWT; nothing is kept in an HTTP session.
* Data is in-memory H2 by default (resets on restart) and can be switched to MySQL per service.

## 2. System context

![System architecture: a client talks only to the api-gateway on port 8080, which routes by path to user-service (8081), claim-service (8083) and workload-service (8084); services call each other directly through Feign](docs/system-architecture.svg)

The picture is `docs/system-architecture.svg` (2x export: `docs/system-architecture.png`). The same system as a Mermaid diagram:

```mermaid
flowchart LR
    client(["Client / Swagger UI"])

    subgraph edge["Edge - reactive (WebFlux)"]
        gw["api-gateway :8080<br/>Spring Cloud Gateway"]
    end

    subgraph svc["Domain services - servlet (MVC) + common library"]
        user["user-service :8081"]
        claim["claim-service :8083"]
        workload["workload-service :8084"]
    end

    userdb[("userdb / user_db")]
    claimdb[("claimdb / claim_db")]

    client --> gw
    gw -->|"/api/users/**, /api/auth/**"| user
    gw -->|"/api/claims/**"| claim
    gw -->|"/api/workload/**"| workload
    claim -->|"Feign"| user
    workload -->|"Feign"| user
    workload -->|"Feign"| claim
    user --- userdb
    claim --- claimdb
```

Clients only ever talk to the gateway. Service-to-service calls go directly between services (not back through the
gateway) using OpenFeign at fixed URLs.

## 3. Modules

| Module | Port | Stack | Owns | Responsibility |
|--------|------|-------|------|----------------|
| `api-gateway` | 8080 | WebFlux, Spring Cloud Gateway, springdoc webflux-ui | – | Single entry point: path routing, aggregated Swagger UI, redirects of common wrong URLs to `/swagger-ui.html`. No security, no business logic. Does **not** depend on `common`. |
| `user-service` | 8081 | MVC, JPA, `common` | `users` table | Every person in the system (claimants, officers, managers): profile, role, officer capacity, active flag. Login and JWT signing. Seeds demo users. |
| `claim-service` | 8083 | MVC, JPA, `common` | `claims`, `claim_history` | Claim submission, assignment, status workflow, audit history, per-officer open-claim counts. Seeds demo claims. |
| `workload-service` | 8084 | MVC, `common` | nothing (stateless) | Utilisation per officer and next-assignee suggestion, computed live from the two services above. |
| `common` | – | plain jar | – | Shared auto-configuration: JWT validation and method security, global exception handler, Feign auth forwarding, OpenAPI bearer scheme. |

Dependencies between services, as call direction:

```
workload-service ──► claim-service ──► user-service
        └──────────────────────────────────▲
```

There are no cycles, so `user-service` can run on its own; `claim-service` needs `user-service`; `workload-service`
needs both. Feign clients call lazily at fixed URLs, so a service still boots when its dependencies are down; calls to
them fail with 502 until they are up.

### Package structure

Every service uses package-by-layer: `controller → service → repository → entity`, with `dto` records for request and
response bodies. Controllers never touch repositories. The directory tree is in the README.

* `user-service`: the layers above plus `config`.
* `claim-service`: the layers plus `client` (Feign), `model` (enums, state machine) and `security` (`Caller`).
* `workload-service`: `client` (Feign) and `model` (`OfficerWorkload`).
* `api-gateway`: the routes are in `application.yml`.
* `common`: shared auto-configuration only (section 9).

## 4. Request flow

### 4.1 Routing

The gateway matches on path prefix and forwards the request unchanged, including the `Authorization` header:

| Path | Target |
|------|--------|
| `/api/users/**`, `/api/auth/**` | user-service |
| `/api/claims/**` | claim-service |
| `/api/workload/**` | workload-service |
| `/docs/<service>/v3/api-docs` | that service's `/v3/api-docs` (prefix stripped, `Host` header preserved so the OpenAPI "server" URL shows the gateway) |

Downstream base URLs come from the `services.{user,claim,workload}.url` settings (defaults and environment variables are
under Configuration in the README). The Feign clients in `claim-service` and `workload-service` read the same
`services.*.url` properties.

### 4.2 Example: a manager assigns a claim

```mermaid
sequenceDiagram
    actor M as Manager
    participant GW as api-gateway
    participant C as claim-service
    participant U as user-service

    M->>GW: PUT /api/claims/7/assignment (Bearer JWT, body officerId=4)
    GW->>C: forward unchanged
    C->>C: validate JWT locally, check role MANAGER
    C->>U: GET /api/users/4 (Feign, same Authorization header)
    U-->>C: role, active, maxCapacity
    C->>C: rules - officer role, active, not current assignee, open claims below capacity
    C->>C: update claim and append claim_history in one transaction
    C-->>GW: 200 claim
    GW-->>M: 200 claim
```

### 4.3 Inside one service

```
HTTP ─► JWT filter ─► controller ─► service ─► repository ─► database
          │             @PreAuthorize   business rules,        Spring Data JPA
          │             @Valid          ownership checks,
          │                             @Transactional, Feign
          └─ any exception ─► GlobalExceptionHandler ─► ApiError JSON
```

## 5. Security

### 5.1 Authentication

1. `POST /api/auth/login` (the only public API endpoint) goes to `user-service`.
2. `AuthService` looks the user up, requires `active`, and checks the password against its BCrypt hash. Unknown user,
   wrong password and disabled account all return the same 401 message so usernames cannot be probed.
3. `TokenService` signs an **HS256** JWT: `iss = chubb-claims-auth`, `sub = username`, `roles = [<ROLE>]`, `iat`,
   `exp` (default 120 minutes).
4. The client sends `Authorization: Bearer <token>` on every later call.

Every servlet service validates the token **locally** with the shared secret (`chubb.security.jwt.secret`, env
`CHUBB_SECURITY_JWT_SECRET`): signature, issuer and expiry. There is no call back to `user-service` per request. Roles
in the `roles` claim become `ROLE_<name>` authorities.

### 5.2 Authorization – two layers

| Layer | Where | Examples |
|-------|-------|----------|
| Role gate | `@PreAuthorize` on controller methods (`@EnableMethodSecurity` in `common`) | assignment is `MANAGER` only; status update is `CLAIMANT`/`OFFICER`/`MANAGER` (the service narrows the claimant, see below); workload is `OFFICER`/`MANAGER` |
| Ownership and state | service layer | a claimant sees only their own claims; officers can only update claims assigned to them (or pick up an unassigned `OPEN` one); through the status endpoint a claimant can only answer an information request on their own claim (`UNDER_REVIEW`, 403 for any other status); claimants can read only their own profile |

The full endpoint-by-role table is in the README.

### 5.3 Identity propagation

* The gateway forwards the `Authorization` header untouched. It does not authenticate anything: an unauthenticated
  request is rejected by the **downstream** service, not at the edge.
* `FeignConfig` (in `common`) copies the incoming `Authorization` header onto every outgoing Feign call, so a
  downstream service enforces the **original caller's** role. There is no service-to-service credential.
* The token carries the **username, not the user id**. When `claim-service` needs the caller's id (for a claimant's own
  claims, or an officer's capacity) it calls `GET /api/users/by-username/{username}`. Claimants may read their own
  profile, so this works with the claimant's own token.

### 5.4 Public paths (every service)

`/api/auth/login`, `/swagger-ui*`, `/v3/api-docs/**`, `/actuator/health/**`, `/actuator/info`, `/h2-console/**`, plus
`OPTIONS`. CSRF is disabled (stateless bearer tokens, no cookies) and sessions are never created.

## 6. Data

### 6.1 Ownership

Each service owns its own database; nobody queries another service's tables. Cross-service references are **plain
columns**, not foreign keys or joins.

```mermaid
erDiagram
    USERS {
        bigint id PK
        string username UK
        string password_hash
        string role
        string full_name
        string email
        boolean active
        string market
        string policy_number
        string specialization
        int max_capacity
    }
    CLAIMS {
        bigint id PK
        string claim_number UK
        bigint claimant_id
        string claimant_name
        string market
        string claim_type
        decimal claim_amount
        date incident_date
        string status
        bigint assigned_officer_id
        string info_request_message
        string info_requested_by
        datetime info_requested_at
        string info_reply_message
        string info_replied_by
        datetime info_replied_at
    }
    CLAIM_HISTORY {
        bigint id PK
        bigint claim_id FK
        string action
        string from_status
        string to_status
        string changed_by
        string remarks
        datetime changed_at
    }
    USERS ||--o{ CLAIMS : "claimant_id - soft reference across databases"
    USERS ||--o{ CLAIMS : "assigned_officer_id - soft reference across databases"
    CLAIMS ||--o{ CLAIM_HISTORY : "claim_id"
```

`USERS` lives in user-service's database; `CLAIMS` and `CLAIM_HISTORY` in claim-service's. Only the last relationship
is a real foreign key.

* **One `users` table for all roles.** The role decides which profile columns apply: claimants use `market` and
  `policy_number`; officers use `specialization` and `max_capacity`. Create and update enforce the mandatory fields per
  role.
* **Markets and claimant names.** `Market` (`SG`, `HK`, `JP`, `TH`, `IN`, `ID`) is an enum in `common`, stored by name.
  `POST /api/claims` requires `claimantName` and `market` in the body. `ClaimService.create` compares them with the
  claimant's `UserSummary`, already fetched through Feign (`fullName` ignoring case and spaces, `market` exactly), and
  answers 409 on a mismatch, so a claimant cannot file into another market. The claim then stores the profile's name and
  market (`claimant_name`, `market`) as snapshots taken at filing time. These columns are nullable in the database
  (`ddl-auto=update` cannot add `NOT NULL` to a table that already has rows) and non-null is enforced in code: a claimant
  without a market also gets 409 when filing. `GET /api/claims` filters by `market` and `claimType`.
* **Claim numbers** have the form `CLM-<year>-<id padded to 6>` (for example `CLM-2026-000042`). The row is first saved
  with a temporary number, then renamed once the generated id exists, in the same transaction.
* **`claim_history` is append-only.** Its columns are `updatable = false`. One row is written for every creation,
  assignment, reassignment, status change, information request and reply, recording who (`changed_by` = username), when, and from → to. The history
  endpoint also returns each entry's `claimId`, `claimantName` and `market`, read from the entry's claim, which the
  history query loads with an entity graph (the `claim` association is lazy and there is no open session at
  serialisation time).

### 6.2 Persistence setup

| | Default | `--spring.profiles.active=mysql` |
|---|---------|----------------------------------|
| Database | in-memory H2 in MySQL mode: `jdbc:h2:mem:userdb`, `jdbc:h2:mem:claimdb` | `user_db`, `claim_db` on `localhost:3306`, created on demand |
| Schema | `spring.jpa.hibernate.ddl-auto=update`, generated from the entities | same |
| Seed data | `DemoDataSeeder` in user-service when the users table is empty (`chubb.seed-demo-users`); `DemoClaimSeeder` in claim-service when the claims table is empty (`chubb.seed-demo-claims`) | same |

Entities stay portable between H2-in-MySQL-mode and MySQL: no vendor-specific types or queries. `workload-service` has
no database at all. Connection overrides and the H2 console are covered in the README (Run and Configuration).

## 7. Claim lifecycle and business rules

The only legal moves are defined once, in `ClaimStatus.canTransitionTo`.

![Claim status flow: OPEN, ASSIGNED, UNDER_REVIEW, APPROVED, SETTLED, CLOSED; asking for more information puts a claim ON_HOLD until the claimant replies; a rejected claim is closed; a claim can be closed early](docs/claim-status-flow.svg)

The picture (`docs/claim-status-flow.svg`, with a 2x export in `docs/claim-status-flow.png`) shows who makes each move.

Rules enforced in `ClaimService`:

* **Submit.** A claimant files for themselves (id taken from their token). Officers and managers must give a `claimantId`,
  which must belong to a `CLAIMANT`. New claims start `OPEN`. `claimantName` and `market` are required in the body and must
  match the claimant's profile (section 6.1); a mismatch is 409.
* **Assign / reassign** (manager only). Allowed while the claim is `OPEN`, `ASSIGNED`, `UNDER_REVIEW` or `ON_HOLD`. The target must
  be an **active `OFFICER`** user, not already the assignee, with `open claims < maxCapacity`. Status moves `OPEN →
  ASSIGNED`; reassigning keeps the current status.
* **Status change** (officer or manager). `ASSIGNED` cannot be set through the status endpoint, only by assignment. Officers
  may update a claim assigned to them, or pick up an unassigned `OPEN` claim (self-assigns, capacity-checked, writes an
  `ASSIGNED` history row first). A claim assigned to a different officer returns 403 "Claim is not assigned to
  you". Managers may update any claim. `REJECTED` and `ON_HOLD` require `remarks`.
* **Request more information** (officer on their own claim, or manager). Moving a claim from `UNDER_REVIEW` to
  `ON_HOLD` through the status endpoint stores the remarks as the request (`info_request_message`, `info_requested_by`,
  `info_requested_at`) and writes an `INFO_REQUESTED` history row. The claim JSON shows it as `infoRequest` (`message`, `requestedBy`, `requestedAt`) while it is open, so the claimant sees
  what to provide.
* **Provide information** (the owning claimant only, through the same `PATCH /api/claims/{id}/status`: status
  `UNDER_REVIEW`, the reply as `remarks`). `ClaimService.updateStatus` sends a claimant to its own branch before any officer
  logic, so there is no pick-up or capacity check. Checks in order: claim exists (404), it is their own claim (403), the
  target is `UNDER_REVIEW` (403 for any other status), the claim is `ON_HOLD` (409 otherwise), remarks are not blank
  (409; at most 500 characters). It then stores the reply (`info_reply_message`, `info_replied_by`, `info_replied_at`, shown
  as `lastReply` with `message`, `repliedBy`, `repliedAt`), writes an
  `INFO_PROVIDED` history row and moves the claim back to `UNDER_REVIEW` in the same transaction, so no staff step is needed
  to resume review.
* **On hold while information is required.** A claim in `ON_HOLD` does not move until the claimant answers. In the
  staff path of `ClaimService.updateStatus`, any target other than `CLOSED` is refused with 409 "Claim is on hold", checked
  before the transition and remarks rules, so an officer or manager cannot resume, approve, reject or settle it. `ClaimStatus`
  still lists `ON_HOLD` to `UNDER_REVIEW` as a legal move, because the claimant's reply uses it; who may make the
  move is the service rule above. Staff can still close the claim (a claimant who never replies) and a manager can reassign it.
* **Illegal moves** return 409 listing the allowed next statuses.
* **List and filter.** `GET /api/claims` returns every claim to officers and managers and only their own to a claimant.
  The filters `market`, `claimType`, `status`, `claimantId` and `assignedOfficerId` are all optional and combinable; an
  unknown market or type returns 400. Every claim shows `claimantName`, `market` and `claimantId`.
* **Status update response.** `PATCH /api/claims/{id}/status` returns the updated claim with all its usual fields, plus
  `previousStatus` (the status before the request) and the `remarks`, `changedBy` and `changedAt` of the change. When an
  officer's update also picks up an `OPEN` claim, `previousStatus` is `OPEN` and the history lists the `ASSIGNED` step too.

"In progress" (`ClaimStatus.IN_PROGRESS` = `ASSIGNED` + `UNDER_REVIEW` + `ON_HOLD`) is the single definition of "open"
used for both the capacity check and the workload numbers: an officer still owns a claim that has asked the claimant for more information.

## 8. Workload calculation

`workload-service` holds no data. For each request it makes two calls:

1. `user-service` `GET /api/users?role=OFFICER&active=true` – who is eligible and each person's `maxCapacity`.
2. `claim-service` `GET /api/claims/stats/open-by-officer` – map of officer id → in-progress claim count.

Per officer: `utilization % = open / maxCapacity × 100` (one decimal, half-up; 100 if `maxCapacity ≤ 0`) and
`available = max(0, maxCapacity − open)`.

| Level | Utilisation |
|-------|-------------|
| `LOW` | below 50 % |
| `MODERATE` | 50 % to below 80 % |
| `HIGH` | 80 % to below 100 % |
| `FULL` | 100 % or more |

The list is sorted least utilised first (ties by id). The suggestion is the first entry with spare capacity; if there
is none the call returns 409.

## 9. Cross-cutting concerns (`common`)

`common` is a plain jar. `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` registers
`CommonAutoConfiguration`, which imports four configurations, so any servlet service gets them just by depending on
the jar:

| Config | Provides |
|--------|----------|
| `SecurityConfig` | Stateless filter chain, JWT decoder (HS256 + issuer check), role-claim → authority mapping, JSON 401 entry point, `@EnableMethodSecurity` |
| `GlobalExceptionHandler` | The only place exceptions become HTTP responses (`ApiError`) |
| `FeignConfig` | `Authorization` header forwarding; downstream 404 → `ResourceNotFoundException` |
| `OpenApiConfig` | OpenAPI title plus a bearer-JWT scheme so Swagger's **Authorize** works |

The gateway is reactive and cannot use the servlet-based `SecurityConfig`, which is why it does not depend on `common`.

### Error model

One JSON shape everywhere: `timestamp`, `status`, `error`, `message`, `path`, `details[]`.

| Cause | Status |
|-------|--------|
| Bean validation failure (field errors in `details`), malformed JSON, bad parameter type | 400 |
| Bad login | 401 |
| `AccessDeniedException` (role or ownership) | 403 |
| `ResourceNotFoundException`, unknown route | 404 |
| Wrong HTTP method / media type | 405 / 415 |
| `BusinessRuleException` (illegal transition, capacity, not an officer), unique-constraint violation | 409 |
| Downstream 4xx (other than 404) is relayed; downstream 5xx or connection failure | 4xx as-is / 502 |
| Anything else | 500 (details logged, not returned) |

The 401 for a **missing or expired token** is written by the security filter before MVC is reached, so it has a slimmer
body: `status`, `error`, `message` only, with a hint to log in again.

## 10. Testing

JUnit 5, Mockito and AssertJ; run with the build.

| Module | Tests |
|--------|-------|
| `claim-service` | `ClaimStatusTest` (state machine), `ClaimServiceTest` (rules, Mockito), `ClaimRepositoryTest` (JPA on H2), `ClaimControllerTest` (`@WebMvcTest`: who may call what, validation, response shape), `StatusUpdateResponseTest` (the status response repeats every claim field), `DemoClaimSeederTest` (demo data respects the workflow and officer capacity) |
| `user-service` | `UserServiceTest`, `AuthServiceTest`, `UserRepositoryTest`, `UserControllerTest` (controller security and validation), `AuthFlowIntegrationTest` (real login, real token, real filter chain) |
| `workload-service` | `WorkloadServiceTest` |
| `common`, `api-gateway` | none |

`workload-service` has no controller-level tests.

## 11. Design decisions and trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| **Database per service**, soft references by id | Services can change and scale independently; no shared-schema coupling | No foreign keys across services; id lookups need a Feign call; see 12.2 |
| **One user service for all roles** | One login, one identity, one place for roles and capacity; claim and workload read officer data from the same source | The `users` table has role-specific nullable columns |
| **Stateless JWT, validated locally** | No per-request call to the auth service; any service can authorise on its own | No revocation or refresh tokens; a token is valid until it expires; every service needs the same secret |
| **Gateway routes but does not authenticate** | Gateway stays thin; each service stays safe even if reached directly | A bad request travels one hop before it is rejected; auth rules exist only in the services |
| **Fixed service URLs, no registry (Eureka)** | Four processes and no extra infrastructure; trivial to run locally | No load balancing or dynamic discovery; each URL is configured by hand per environment |
| **Caller's token forwarded on Feign calls** | Original role enforced end to end; no service accounts to manage | A service can only do what the end user may do; background or system-initiated calls would need a different mechanism |
| **Shared `common` library as auto-configuration** | One place for security, errors and OpenAPI; services add nothing to adopt it | Changes to `common` require rebuilding every service |
| **Workload computed live** | Always consistent with the claims; nothing to keep in sync | Two synchronous calls per request; no caching |

## 12. Known limitations

Fine for a local demo; address before production.

### 12.1 Security

* The default JWT secret is in the source. Set `CHUBB_SECURITY_JWT_SECRET` (same value in user, claim and workload).
* `/h2-console/**` is on the public path list of every service and the H2 console is enabled by default. Disable both
  outside local use (the `mysql` profile turns the console off, but the path stays permitted).
* No token revocation, refresh tokens or self-service password change.
* The gateway has no rate limiting or CORS configuration.
* Demo credentials are seeded on first start; set `chubb.seed-demo-users=false` and `chubb.seed-demo-claims=false` in
  production (the demo claims reference the demo user ids).

### 12.2 Data and consistency

* **Capacity check is not atomic.** `assign` and officer pick-up count open claims, then save, with no row lock or
  `@Version`. Two concurrent assignments to an officer one claim below capacity can both succeed and exceed it.
* **No referential integrity across services.** Deleting a user does not check or update claims that reference
  them (`claimant_id`, `assigned_officer_id`), and claims are not cascaded.
* **No schema migrations.** Tables come from `ddl-auto=update`; there is no Flyway or Liquibase. This matters after
  the *staff → officer* rename: the in-memory H2 default is unaffected, but an existing MySQL database keeps the old
  `role = 'STAFF'` values (which no longer map to the `Role` enum) and gains an empty `assigned_officer_id` column
  next to the old one. Migrate once, before starting the new build:

  ```sql
  -- user_db
  UPDATE users SET role = 'OFFICER' WHERE role = 'STAFF';
  -- claim_db
  ALTER TABLE claims CHANGE assigned_staff_id assigned_officer_id BIGINT;
  ```

  The same applies to the *country → market* change. Start the new build once so Hibernate adds the nullable
  `market` columns, then backfill and drop the old column (the two databases are separate, so the `claims` backfill is
  done per claimant id, using each claimant's `market` from `user_db`; claims with no market cannot be filtered by it):

  ```sql
  -- user_db
  UPDATE users SET market = CASE country
      WHEN 'Singapore' THEN 'SG' WHEN 'Hong Kong' THEN 'HK' WHEN 'Japan' THEN 'JP'
      WHEN 'Thailand' THEN 'TH' WHEN 'India' THEN 'IN' WHEN 'Indonesia' THEN 'ID' END
  WHERE role = 'CLAIMANT';
  ALTER TABLE users DROP COLUMN country;
  -- claim_db, repeated for each claimant (ids and markets read from user_db)
  UPDATE claims SET market = 'SG', claimant_name = 'Wei Lim' WHERE claimant_id IN (2);
  ```

  Hibernate also adds the nullable `claims.claimant_name` column, so the same per-claimant `UPDATE` sets the name; claims
  without one show `claimantName: null` until then.

  **Enum columns on MySQL.** Hibernate 6.5's MySQL dialect declares `@Enumerated(STRING)` columns as native
  `enum('A','B',...)`, and `ddl-auto=update` never changes an existing column definition. The in-memory H2 default is
  recreated on every start, so it is unaffected, but on an existing MySQL database any **new enum constant** is rejected
  (`Data truncated`) until the column is altered. Run `SHOW CREATE TABLE <table>` first: if the column is an `enum(...)` the
  `ALTER` statements below apply, and if it is a plain `varchar` they can be skipped. Adjust the column names if yours differ.

  The market list is six markets: **India (`IN`) replaced Malaysia (`MY`)**. A database that ever held `MY` can no longer
  load those rows (there is no `Market.MY`), so allow `IN` first, relabel, then tighten the column. Delete the rows instead
  if they should not become India:

  ```sql
  -- user_db
  ALTER TABLE users MODIFY market ENUM('SG','HK','JP','TH','MY','IN','ID');
  UPDATE users SET market = 'IN' WHERE market = 'MY';
  ALTER TABLE users MODIFY market ENUM('SG','HK','JP','TH','IN','ID');
  -- claim_db
  ALTER TABLE claims MODIFY market ENUM('SG','HK','JP','TH','MY','IN','ID');
  UPDATE claims SET market = 'IN' WHERE market = 'MY';
  ALTER TABLE claims MODIFY market ENUM('SG','HK','JP','TH','IN','ID');
  ```

  The **`ON_HOLD` status** and the **`INFO_REQUESTED` / `INFO_PROVIDED` history actions** are new enum constants too.
  Start the new build once (Hibernate adds the six nullable `info_*` columns on `claims`), and before anyone uses the
  feature run:

  ```sql
  -- claim_db
  ALTER TABLE claims MODIFY status
      ENUM('OPEN','ASSIGNED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NOT NULL;
  ALTER TABLE claim_history MODIFY from_status
      ENUM('OPEN','ASSIGNED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NULL;
  ALTER TABLE claim_history MODIFY to_status
      ENUM('OPEN','ASSIGNED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NOT NULL;
  ALTER TABLE claim_history MODIFY action
      ENUM('CREATED','ASSIGNED','REASSIGNED','STATUS_CHANGED','INFO_REQUESTED','INFO_PROVIDED') NOT NULL;
  ```

  The status was first called **`AWAITING_INFO`**, then **`MORE_INFO_REQUIRED`**, and is now **`ON_HOLD`**. If a database
  already ran an earlier build (the statements above are then partly applied, and rows may hold either old name), allow
  all three names, relabel the rows, then tighten the column. This is an untested sketch like the other notes here, so check
  `SHOW CREATE TABLE` first. A database that never saw an old name only needs the statements above.

  ```sql
  -- claim_db
  ALTER TABLE claims MODIFY status ENUM('OPEN','ASSIGNED','UNDER_REVIEW','AWAITING_INFO','MORE_INFO_REQUIRED','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NOT NULL;
  ALTER TABLE claim_history MODIFY from_status ENUM('OPEN','ASSIGNED','UNDER_REVIEW','AWAITING_INFO','MORE_INFO_REQUIRED','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NULL;
  ALTER TABLE claim_history MODIFY to_status ENUM('OPEN','ASSIGNED','UNDER_REVIEW','AWAITING_INFO','MORE_INFO_REQUIRED','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NOT NULL;
  UPDATE claims SET status = 'ON_HOLD' WHERE status IN ('AWAITING_INFO','MORE_INFO_REQUIRED');
  UPDATE claim_history SET from_status = 'ON_HOLD' WHERE from_status IN ('AWAITING_INFO','MORE_INFO_REQUIRED');
  UPDATE claim_history SET to_status = 'ON_HOLD' WHERE to_status IN ('AWAITING_INFO','MORE_INFO_REQUIRED');
  ALTER TABLE claims MODIFY status ENUM('OPEN','ASSIGNED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NOT NULL;
  ALTER TABLE claim_history MODIFY from_status ENUM('OPEN','ASSIGNED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NULL;
  ALTER TABLE claim_history MODIFY to_status ENUM('OPEN','ASSIGNED','UNDER_REVIEW','ON_HOLD','APPROVED','REJECTED','SETTLED','CLOSED') NOT NULL;
  ```
* **Shared `DB_URL`.** `user-service` and `claim-service` read the same variable names for the `mysql` profile. If you
  set `DB_URL` globally, both services point at the same database and database-per-service is lost; set it per
  process.

### 12.3 Resilience and operations

* No retries, circuit breakers or bulkheads, and no explicit Feign timeouts (Feign defaults apply). A slow `user-service`
  slows every service that calls it, and `workload-service` fails as a whole if either dependency fails.
* No distributed tracing, metrics beyond actuator health/info, or centralised logging.
* Each service is a single instance; the gateway has no load balancing.

### 12.4 Where this is likely to grow

* Replace the lookup in `AuthService` in `user-service` with an identity-provider backed implementation (the users table
  already stores hashed passwords and an active flag).
* Replace fixed URLs with a registry or platform service discovery, and move the gateway route targets to `lb://`.
* Replace the shared HS256 secret with an identity provider and asymmetric (RS256/JWKS) validation.
* Add `@Version` (optimistic locking) on `Claim`, or a database-level capacity guard.
* Publish claim events (assigned, status changed) so workload can be pushed or cached rather than recomputed.
