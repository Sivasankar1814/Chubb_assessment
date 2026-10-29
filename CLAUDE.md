# CLAUDE.md

Guidance for Claude Code (and other contributors) working in this repository. It covers the **whole application**, the Angular
web app and the Spring Boot backend, in one file: there is one set of documents (`README.md`, `CLAUDE.md`, `architecture.md`,
`Ai_journal.md`) at the repository root, and none per folder.

## Project

Chubb APAC Claims Management, two halves in one repository:

* **Backend** (`backend-claim-management/`): Java 21, Spring Boot 3.3.5, Spring Cloud 2023.0.3, Maven multi-module.
* **Web app** (`frontend/`): Angular 22 (standalone, signals, zoneless), Angular Material 3, Vitest for unit tests,
  Playwright for end-to-end. It talks to the backend only through the gateway, with a relative `/api` base
  (`core/config/api-base-url.ts`).

See `README.md` for setup, configuration, demo users, the API walkthrough and run instructions, `architecture.md` for the
architecture, security model, data design, business rules and the web app's structure, and `Ai_journal.md` for how the
system was built with AI assistance and what that taught.

## Modules and ports

| Module | Port | Package root |
|--------|------|--------------|
| api-gateway (reactive, no `common`) | 8080 | `com.chubb.claims.gateway` |
| user-service (all users + login) | 8081 | `com.chubb.claims.user` |
| claim-service | 8083 | `com.chubb.claims.claim` |
| workload-service (stateless, no DB) | 8084 | `com.chubb.claims.workload` |
| common (plain jar, auto-configuration) | – | `com.chubb.claims.common` |
| frontend (Angular app, not a Maven module) | 4200 (dev server) | `frontend/src/app` |

## Demo users and ids

Created by `user-service`'s `DemoDataSeeder` when the users table is empty. All users share **one id list**, in seed order:

| Username | Password | Role | User id |
|----------|----------|------|---------|
| `claimant1` | `claimant123` | CLAIMANT | 1 (Aiko Tanaka, market JP) |
| `claimant2` | `claimant123` | CLAIMANT | 2 (Wei Lim, market SG) |
| `officer1` | `officer123` | OFFICER | 3 (Priya Nair, capacity 5) |
| `officer2` | `officer123` | OFFICER | 4 (Daniel Chen, capacity 8) |
| `manager1` | `manager123` | MANAGER | 5 (Maria Santos) |
| `claimant3` | `claimant123` | CLAIMANT | 6 (Mei Chen, market HK) |
| `claimant4` | `claimant123` | CLAIMANT | 7 (Somchai Prasert, market TH) |
| `claimant5` | `claimant123` | CLAIMANT | 8 (Arjun Mehta, market IN) |
| `claimant6` | `claimant123` | CLAIMANT | 9 (Budi Santoso, market ID) |

* **Policy number on a claim** (2026-10-29): `Claim.policyNumber` is set by `ClaimService.create` through `policyNumberFor` and never taken
  from `CreateClaimRequest`: the claimant's profile `policyNumber` if text, else `POL-<market>-<user id, 4 digits>`. The frontend shows
  a preview of the same rule (`shared/policy-number.ts`): change both together and keep the examples in `ClaimServiceTest` and
  `policy-number.spec.ts` identical. Nullable column; older claims have none. `StatusUpdateResponse` carries it (its test enforces that).
* **Officers and managers may file claims in their own name** (`POST /api/claims` with no `claimantId`: `ClaimService.resolveClaimant`
  uses the caller's own profile, as for a claimant; a `claimantId` still files on that claimant's behalf and must be a CLAIMANT).
  Asked for by the user on 2026-10-29. Known, accepted gaps: nothing stops staff approving or settling a claim they filed
  themselves, and an `ON_HOLD` request on a staff-owned claim can only be closed (the reply path is claimant-only). Do not "fix"
  either without asking.
* A claim's `claimantId` and `assignedOfficerId` are **user ids**. `assignedOfficerId` must belong to an OFFICER user (3 or 4);
  assigning any other id fails with 409 "User … is not an officer". Only `officer1` and `officer2` exist (no `officer3`/`officer4`).
  The four extra claimants were appended after `manager1` on purpose, so ids 1-5 never moved; keep appending.
* Logins are by username, never by id. Data is in-memory H2, so users, claims and ids reset on every restart.

## Demo claims

`claim-service`'s `DemoClaimSeeder` creates 14 claims when the claims table is empty (`chubb.seed-demo-claims`, default
`true`): one MOTOR and one PROPERTY per market (SG, HK, JP, TH, IN, ID) plus a HEALTH (JP) and a TRAVEL (SG) claim, in every
status from OPEN to CLOSED, each with a full `claim_history` trail. It writes to the repositories directly and hard-codes the
demo user ids above (claimants 1, 2, 6-9, officers 3 and 4), so change both together, and set it to `false` wherever
`chubb.seed-demo-users` is `false`. Four claims are in progress (2 per officer), within capacity 5 and 8. Endpoints are still
JWT-protected: log in first.

## Authentication flow

* `POST /api/auth/login` (public, through the gateway on :8080) returns a JWT (default 120 minutes). Send it as
  `Authorization: Bearer <token>`. `common`'s `SecurityConfig` validates it; only `user-service` signs tokens.
* Swagger UI (http://localhost:8080/swagger-ui.html): pick **user-service**, run the login, click **Authorize**, paste the
  token without `Bearer `. The login is remembered across reloads (`springdoc.swagger-ui.persist-authorization` in
  `api-gateway/src/main/resources/application.yml`); click **Logout** in the dialog before switching user.
* The web app keeps the token in `sessionStorage` and sends it only on calls to its own `/api`; the token carries the username,
  not the id, so the app reads `GET /api/users/me` after signing in. There is no refresh token.
* Status codes: **401** no/invalid/expired token or bad login; **403** role not allowed or not your resource;
  **409** business rule broken (illegal status move, assignee not an officer, officer at full capacity); **400** validation.

## Commands

Backend, from `backend-claim-management/`:

```bash
./mvnw clean install                       # build + all tests (mvnw.cmd on Windows)
./mvnw -pl claim-service -am test          # one module (+ common)
./mvnw -pl claim-service test -Dtest=ClaimServiceTest
./mvnw -pl <module> spring-boot:run        # run a service
```

Needs JDK 21 (`JAVA_HOME`). `scripts/start-all.ps1` builds and launches everything on Windows.

Web app, from `frontend/`:

```bash
npm start                 # dev server :4200, proxies /api to :8080 (proxy.conf.json)
npx ng test --no-watch    # unit tests, one run
npm run lint              # must stay clean
npm run format            # Prettier; run before finishing
npm run build             # production build
npm run e2e               # needs the backend running (backend-claim-management\scripts\start-all.ps1)
```

Node must satisfy the CLI's engines (22.22.3+, 24.15+, 26+). On this machine Node is in `C:\Program Files\nodejs` but not
always on PATH (`scripts\start-frontend.ps1` handles that).

## Running locally (Windows)

* Health: `GET /actuator/health` on 8080, 8081, 8083 and 8084 must all return 200.
* **Stop this project's services by their command line, never with `Get-Process java | Stop-Process`**: other Java programs
  (an IDE such as IntelliJ) share `java.exe`, and a blanket kill takes them down too:

  ```powershell
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -match '-1\.0\.0\.jar' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  ```

  Then start **exactly one** set of the four jars (`user-service`, `claim-service`, `workload-service`, `api-gateway`). A
  double start leaves two sets of Java processes: check the process count (8, because the Oracle launcher stub shows each
  service as two `java` processes).
* Running jars lock their files, so stop services before rebuilding. Spring Boot fat jars are not repackaged when only a
  dependency (`common`) changed: use `./mvnw clean install` after editing `common`.
* Services started hidden write to `%TEMP%\cms-logs\<service>.out.log` / `.err.log` when launched with redirected output.
* **Restarting `user-service` resets its users** to the seeded nine (in-memory data), and restarting `claim-service` clears its
  claims; use `--chubb.seed-demo-claims=false` to start `claim-service` with none (the demo claims refer to the seeded user ids).
* **The Angular dev server can get stuck.** Editing several files of a component one after another can make a rebuild fail
  halfway, and `ng serve` may then keep serving a mismatched bundle (odd runtime template errors such as
  `ctx.x is not a function`). Look for "Application bundle generation complete" in its log, and restart `ng serve` rather than
  assuming a code bug.
* Run the end-to-end suite on a quiet machine: it has a 60-second limit per test and one worker, and heavy programs make it time
  out.

## Backend rules

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
* **Officer profile fields are optional** (2026-10-29, the New user page no longer asks for them): `UserService.applyRoleDetails`
  stores a null `specialization` (it is display only) and, when `maxCapacity` is omitted, `DEFAULT_OFFICER_CAPACITY` = 5. Do
  not make capacity nullable downstream: `claim-service` (`assign`, `claimForOfficer`) and `workload-service` read `int
  maxCapacity`, so a missing one is 0 and the officer could never take a claim. A `PUT` that omits it resets it to 5.
* **Security:** roles are `CLAIMANT`, `OFFICER`, `MANAGER`. **Officers may create users of any role, `MANAGER` included**
  (`UserService.create` has no caller check; the controller gate is `OFFICER`/`MANAGER`): the user asked for this on
  2026-10-29, knowing an officer can thereby create an account more privileged than their own. Do not "fix" it without asking.
  Update and delete of users stay manager-only. Use `@PreAuthorize("hasRole(..)")` for role gates; ownership
  rules (claimant sees only their own data, officers only update claims assigned to them) belong in the service layer.
  `claim-service` passes a framework-free `Caller` record into services to keep them unit-testable.
* **Claim workflow** is defined once in `ClaimStatus.canTransitionTo`. Every state change must write a
  `claim_history` row (`ClaimService.record`, saved through `ClaimHistoryRepository`). `ASSIGNED` is only set by the assignment operation, or when OFFICERS pick up an unassigned `OPEN` claim by updating its status (`ClaimService.claimForOfficer`: self-assigns, capacity-checked, history row written). A claim assigned to another officer still gives 403 "Claim is not assigned to you". A MANAGER may also move an `OPEN` claim straight to `UNDER_REVIEW` with no officer (`OPEN` lists `UNDER_REVIEW` in `ClaimStatus`): `assignedOfficerId` stays null, nobody's workload changes, the history shows the manager, and the manager can still assign an officer later (a first assignment, status kept). An officer never makes that move (picking up assigns first), and cannot take such a claim over: `claimForOfficer` refuses an unassigned claim that is no longer `OPEN` with the same 403. Statuses: `OPEN`, `ASSIGNED`, `UNDER_REVIEW`, `ON_HOLD`, `APPROVED`, `REJECTED`, `SETTLED`, `CLOSED` (status columns are 20 characters wide).
* **Market** (`SG, HK, JP, TH, IN, ID`) is the enum `common.model.Market`. A claimant's `users.market` and `policy_number` are
  **optional** (`UserService.applyRoleDetails` stores whatever is sent; the New user screen sends neither): a claim's market is
  chosen when the claim is filed. `POST /api/claims` requires `claimantName` and `market` in the body;
  `ClaimService.create` compares the name with the claimant's `UserSummary` (`fullName` ignoring case and spaces) and throws
  `BusinessRuleException` (409) on a mismatch. A claimant who **has** a profile market (the demo claimants) may only file in
  it (409 otherwise); one without a market files in whichever market is sent. The claim stores the profile's name and the
  requested market (`claims.claimant_name`, `claims.market`) as snapshots, never the typed name. A `PUT /api/users/{id}` that
  omits `market`/`policyNumber` clears them (PUT replaces). `GET /api/claims`
  filters by `market` and `claimType`. These columns are nullable in the DB (`ddl-auto=update` cannot add NOT NULL to
  populated tables); non-null is enforced in code. `DemoClaimSeeder` must keep the names and markets of the seeded users.
  History entries (`GET /api/claims/{id}/history`) also expose `claimantName` and `market` through `ClaimHistory`
  getters that read the lazy `claim`. `open-in-view` is off, so `ClaimHistoryRepository`'s query loads it with
  `@EntityGraph(attributePaths = "claim")`: keep that on any new history query, or serialisation throws
  `LazyInitializationException`.
* **Status update result:** `ClaimService.updateStatus` returns a `StatusChange` (the claim, its status before the request,
  and the `STATUS_CHANGED` history entry it wrote); the controller maps it to `StatusUpdateResponse`, which repeats every
  claim field at the top level (spelled out, not `@JsonUnwrapped`, because springdoc drops unwrapped fields from the Swagger
  schema) and adds `previousStatus`, `remarks`, `changedBy` and `changedAt`. When `Claim` gains a field, add it to that
  record too; `StatusUpdateResponseTest` fails otherwise. `ClaimService.record` returns the entry it saves.
* **Information requests** (`ON_HOLD`): an assigned officer or a manager moves a claim from `UNDER_REVIEW` to
  `ON_HOLD` through `PATCH .../status`; remarks are mandatory and become the request (`Claim.requestInformation`,
  history action `INFO_REQUESTED`). Only the owning claimant answers, through the same `PATCH .../status` with status
  `UNDER_REVIEW` and the reply as `remarks` (the claimant branch of `ClaimService.updateStatus`, history action
  `INFO_PROVIDED`), which puts the claim straight back to `UNDER_REVIEW`. There is no separate `/information` endpoint, and a
  claimant may do nothing else through the status endpoint (403); the claimant branch must never reach `claimForOfficer`. The
  claim JSON shows `infoRequest` (only while `ON_HOLD`) and `lastReply` through computed getters; the raw
  `info_*` columns have no getters. An `ON_HOLD` claim is on hold until the claimant answers: the staff path of
  `ClaimService.updateStatus` refuses every target except `CLOSED` (409 "Claim is on hold"), so only the claimant's reply
  resumes review, and then the officer or manager processes it. Keep that check ahead of the transition and remarks
  checks; `ClaimStatus` still allows `ON_HOLD` to `UNDER_REVIEW` because the claimant's reply uses it. The status was
  renamed twice (`AWAITING_INFO`, then `MORE_INFO_REQUIRED`): the old names are gone everywhere except the MySQL rename
  note in `architecture.md` section 23.2 and the guard in `ClaimStatusTest`.
* **Workload** = claims in `ASSIGNED`/`UNDER_REVIEW`/`ON_HOLD` (the officer still owns a claim that waits for the
  claimant). Defined once in `ClaimStatus.IN_PROGRESS` and used by the repository count queries and the `assign` rule.
* **New enum constants need a MySQL `ALTER`.** Hibernate 6.5's MySQL dialect declares `@Enumerated(STRING)` columns as native
  `enum(...)`, and `ddl-auto=update` never extends an existing one. Adding a `ClaimStatus`, `Action`, `Market`... value works
  on H2 (recreated each start) but fails on an existing MySQL database until the column is altered: add the ALTER to
  `architecture.md` section 23.2 in the same change.
* DTOs are Java `record`s with Jakarta Validation annotations; entities are JPA `@Entity` classes (private fields, getters, no setters; state changes go through intention-revealing methods such as `Claim.assignTo`) in each service's `entity` package. Cross-service references (`claimantId`, `assignedOfficerId`) are plain columns, never joins.
  New endpoints need a Swagger `@Operation(summary = ..)`.

## Frontend rules

* **The server is the authority.** `claim-workflow.ts` and the role guard only decide what the UI offers; never rely on them
  for access. A 403 or 409 from the backend always wins, and is shown, not hidden.
* **Keep the models in step with the backend DTOs** (`src/app/models`). When the backend changes a field or enum, change
  it here, and `claim-workflow.ts` if a status or transition moved (the backend defines them once in `ClaimStatus`).
* **All HTTP goes through the API services** (`claims-api`, `users-api`, `workload-api`, `AuthService`), never `HttpClient`
  from a component. Calls whose caller shows the error itself (forms, dialogs) pass the `SKIP_ERROR_NOTIFICATION` context
  (the services' `inline` option) so the user does not get a snackbar as well.
* **The token goes only to `/api`.** `authInterceptor` checks the URL; do not add a second place that sets the header.
* **Dates:** `incidentDate` is a plain `yyyy-MM-dd` and timestamps have no zone. Build and read dates from their local
  parts (`shared/dates.ts`); never send `Date#toISOString()`.
* **Currency follows the market** (`models/currency.ts`). The backend stores a bare amount, so the claim's market says what
  currency it is in. Show every amount with the `money` pipe (`claim.claimAmount | money: claim.market`), never with
  `number` and never with a hand-typed symbol. Yen and rupiah have no decimals: the amount validator takes the limit
  from the market. There is no conversion between currencies, on purpose: no rates exist anywhere to convert with.
* **The New claim page is one page for every role.** The claimant's name is the signed-in user's, and the request never
  carries a `claimantId` or a `policyNumber` (the server decides the policy number; the page only previews it). A claimant
  whose profile has a market sees it locked; everyone else chooses it. Do not give staff a different form.
* **Every `<form (ngSubmit)>` needs a `[formGroup]`** (or `FormsModule`). Without one nothing handles the submit event and
  the browser reloads the page. This broke the status dialog once; `status-change-dialog.spec.ts` fires a real submit event
  to guard it.
* **Status colours are always paired with an icon and a word** (`StatusChip`, `WorkloadMeter`). Colours come from the
  tokens in `styles.scss` (`--app-*`, light/dark via `light-dark()`); do not hard-code hex in components.
* **No secrets in the bundle.** The demo credentials on the login page sit behind `ngDevMode` so a production build drops
  them; check with `grep -r claimant123 dist` after changing that file.
* Don't add `innerHTML`, `bypassSecurityTrust*` or inline scripts: the nginx CSP allows same-origin scripts only.

### Design system

* **Tokens live in `src/styles.scss`** and nowhere else: brand (`--app-brand-*`, `--app-on-brand*`, the gradients), surfaces
  (`--app-canvas`, `--app-card`), depth (`--app-shadow-*`), shape and motion (`--app-radius*`, `--app-ease`, `--app-fast`,
  `--app-base`). Components use them; no hex or `rgb()` values in a component's styles.
* **Fonts and images are same-origin** (the CSP). Inter Variable is self-hosted through `@fontsource-variable/inter`, loaded in
  `angular.json`; never link Google Fonts. Imagery is inline SVG or CSS.
* **Shared pieces first:** `BrandMark`, `Avatar`, `StatusChip`, `StateMessage`, and the global classes `.page`, `.page-header`,
  `.surface-card`, `.facts`, `.icon-badge`, `.back-link` and `.skeleton`. Loading states show a progress bar plus
  `.skeleton` placeholders (marked `aria-hidden`), not a blank page.
* Sections rise in through `.page > *`. That animation uses `backwards`, not `both`: a lingering `transform` would trap
  fixed-position children. Everything animated must stay calm under `prefers-reduced-motion` (a global rule handles it).
* Filled buttons are brand blue in both themes (set once in `styles.scss`); the sign-in screen and the sidebar are the only
  places that are always dark.
* **Responsive:** the shell switches to an overlay drawer at 900px; the claims list collapses its filters behind a button and
  drops to two columns at 640px. Check any new page at 390px, 820px and 1440px, in light and dark, with nothing scrolling
  sideways.
* **The login page is exactly one screen** (`height: 100dvh`, never `min-height`): spacing follows the window height, the brand
  panel sheds its decoration on short windows, and only the form panel may scroll, in a window too short for the form. Do not
  pull content above a scroll container with a negative margin (it is clipped); move the container instead.

### Frontend conventions

* Standalone components, `inject()`, signals, new control flow (`@if`/`@for`/`@let`), `input()`/`output()`.
* Files are named after what they contain, kebab-case (`claim-list-page.ts`, `auth-service.ts`); components use the `app-`
  prefix. Page components end in `Page`, API classes in `Api`.
* Pages that load data use `loadState()` (`shared/load-state.ts`) and render the loading, error (with retry) and empty
  states. Pages read the route via `withComponentInputBinding` (`input.required<string>()` for `:id`).
* Reuse `StateMessage`, `StatusChip`, `WorkloadMeter`, `ConfirmService` before writing new UI.
* Comments say *why*, not what. Format with Prettier (`.prettierrc`).

## Cross-stack contracts

The web app holds a few copies of server rules so it can offer only what works. The server is always the authority, and the
copies are kept equal by shared test examples. **When one side changes, change the other in the same change**, and keep the
table in `architecture.md` section 21 true:

| Contract | Backend | Frontend |
|----------|---------|----------|
| Claim workflow | `ClaimStatus.canTransitionTo`, `ClaimService` | `features/claims/claim-workflow.ts` |
| Policy number | `ClaimService.policyNumberFor` | `shared/policy-number.ts`; one example table in `ClaimServiceTest` and `policy-number.spec.ts` |
| Markets and currencies | `Market` enum | `MARKETS`, `models/currency.ts` |
| DTO shapes and enums | request and response records, enums | `src/app/models` |
| Roles | `Role`, `@PreAuthorize`, service rules | `ROLES`, `roleGuard`, `HasRole` (they only hide) |
| Officer default capacity | `UserService.DEFAULT_OFFICER_CAPACITY` (5) | the sentence "up to 5 open at a time" on the New user page |

A backend change that the UI depends on (a DTO field, a rule, an enum) is done together with the UI change, and both halves'
tests are run.

## Testing conventions

Backend:

* JUnit 5 + Mockito (`@ExtendWith(MockitoExtension.class)`) for services; AssertJ assertions.
* `@WebMvcTest` + `@Import(CommonAutoConfiguration.class)` + `@MockBean` service for controller security/validation
  (use `jwt().jwt(t -> t.subject("user")).authorities(new SimpleGrantedAuthority("ROLE_OFFICER"))` instead of real tokens).
* `@DataJpaTest` for repositories (Hibernate creates the schema on embedded H2).
* `@SpringBootTest` + `@AutoConfigureMockMvc` for full flows, e.g. `AuthFlowIntegrationTest` in `user-service`
  (real login, real token, real filter chain, seeded demo users).
* Add or update tests with every behaviour change; `./mvnw clean install` must stay green.

Web app:

* Unit tests sit next to the code. Prefer testing behaviour (what the user or the network sees) over implementation.
* Add an e2e test in `e2e/` for any new user journey. Each test files its own claim so runs are repeatable; the serial
  lifecycle spec shares one claim across roles on purpose. The specs are written against the seeded demo users.
* Playwright selectors: scope to a region or the navigation (`getByRole('region', { name })`) when a label appears in several
  places, or strict mode will fail. To read the value beside a label in a definition list, take the `dt` and then
  `xpath=following-sibling::dd[1]`: a `div` filtered by its `dt` returns the first `dd` of the whole block.
* An assertion that cannot fail is worse than none: check that a "does not contain" test also has a "does contain" case that
  proves the helper finds anything.
* After a UI change, look at it in a browser at desktop and phone width, light and dark.

## Working agreements

* For multi-file or behaviour-changing work, plan first (plan mode), update this file, then implement.
* **One set of documents.** Keep `README.md`, `CLAUDE.md`, `architecture.md` and `Ai_journal.md` in sync in the same change,
  each covering the backend and the web app. Do not add a `README.md` or `CLAUDE.md` inside a folder, or a separate document
  for one half: extend these four. Stale facts here mislead the next session.
* Pictures live in `docs/`. Three are hand-written SVGs (no script or style blocks, their own dark background so they read the
  same in light and dark viewers) with a 2x PNG export beside each, each embedded in exactly one document:
  `claim-status-flow.svg` (statuses and who makes each move, `architecture.md` section 7), `system-architecture.svg`
  (the web app, gateway routes, Feign calls between services, who owns a database, `architecture.md` section 2) and
  `tech-stack.svg` (the top banner of `README.md`: dependencies and versions of both halves, plus the counts of services, web
  app, statuses, roles and markets). The screenshots in `docs/screens/` are embedded in `README.md` only. Do not embed a
  picture in a second document. When a status, transition, route, port, service call, dependency or version changes, or one
  of those counts does, update the SVG, then re-export the PNG with `msedge --headless=new --hide-scrollbars --force-device-scale-factor=2
  --window-size=<viewBox width>,<viewBox height> --screenshot=docs/<name>.png file:///<path>/docs/<name>.svg`, and look at
  the result. Retake a screenshot when its screen changes visibly.
* Before calling work done:
  * Backend: `./mvnw clean install` passes and a live check through the gateway (login, then the affected endpoints) behaves
    as documented.
  * Web app: `npm run lint` is clean, `npx ng test --no-watch` passes, `npm run format` has been run, and the change has been
    looked at in a browser at desktop and phone width, light and dark. A new user journey has an e2e test.
  * A change that crosses the two: both of the above, plus the contracts table.

## Conventions

* Backend: package-by-layer inside each service (`controller`, `service`, `repository`, `entity`, `dto`, `client`; claim-service keeps its enums in `model`).
* Backend: constructor injection only; no Lombok.
* Keep comments for non-obvious *why*; follow the surrounding code's style.
* Don't commit `target/`, `node_modules/` or `dist/`; demo credentials are for local use only.

## Known simplifications

* One `users` table in `user-service` holds claimants, officers and managers (single `User` entity; the role decides which profile columns apply). No refresh tokens / token revocation / self-service password change.
* The JWT secret has a built-in demo default; every service must share the same `CHUBB_SECURITY_JWT_SECRET` outside local use.
* No service discovery: services and the gateway call each other at fixed URLs (`services.<name>.url`, defaulting to localhost:8081-8084).
* The web app fetches the claims list whole and filters, sorts and pages it in the browser (the API has no paging), and the
  session is the JWT in `sessionStorage` with no refresh token: it ends at the token's expiry.
* The Docker image for the web app has not been built or run.
