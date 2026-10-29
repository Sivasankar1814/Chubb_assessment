# AI-Assisted Development Journal

**Project:** Chubb APAC Claims Management, the Spring Boot backend and the Angular web app
**Tool:** Claude Code (CLI), used throughout design, implementation, debugging, redesign and documentation
**Purpose of this document:** an honest account of how AI was used to build the whole system, where it helped, where it
needed correction, and how its output was checked. Prompts are paraphrased and grouped by phase.

**Terminology:** the role now called *officer* was called *staff* until phase 4, and the status now called `ON_HOLD` was
`AWAITING_INFO` and then `MORE_INFO_REQUIRED`. Prompts quoted below keep the word that was used at the time; descriptions
of the current system use the current names.

## Contents

| Part | Phase |
|------|-------|
| [1. Summary](#1-summary) | What was delivered and how it was kept in check |
| [2. How the work was run](#2-how-the-work-was-run) | The working method, shared by both halves |
| [3](#3-phase-1-initial-brief) to [7](#7-phase-5-documentation) | Backend: brief, operating the system, debugging, behaviour changes, documentation |
| [8](#8-phase-6-the-web-app) and [9](#9-phase-7-redesign) | Web app: the first build and the redesign |
| [10. Phase 8](#10-phase-8-product-changes-driven-by-the-user) | Product changes the user asked for, across both halves |
| [11. Phase 9](#11-phase-9-one-repository-one-set-of-documents) | One repository, one set of documents |
| [12](#12-how-ai-output-was-verified) to [15](#15-lessons-learned) | Verification, where AI needed correction, limitations, lessons |

## 1. Summary

| | |
|---|---|
| **Delivered, backend** | Five-module Maven build: reactive API gateway (8080, no `common`), `user-service` (8081), `claim-service` (8083), stateless `workload-service` (8084, no DB) and a shared `common` library. Java 21, Spring Boot 3.3.5, Spring Cloud 2023.0.3 (Gateway, OpenFeign), Spring Security with JWT, JPA on in-memory H2 by default or MySQL (`--spring.profiles.active=mysql`), Swagger UI. |
| **Delivered, web app** | Angular 22 single-page app (standalone components, signals, zoneless) with Angular Material 3: sign-in, a dashboard per role, claims list and detail, filing a claim, status and assignment dialogs, information requests and replies, officer workload, user registration, a profile page, light and dark themes, and a layout that works from a 390px phone to a desktop. It reaches the backend only through the gateway. |
| **Business scope** | Claim submission in six APAC markets, assignment to officers, a status workflow with an audit trail, role-based access for claimants, officers and managers, an officer workload calculation, and per-market currency display. |
| **How AI was used** | Scaffolding and implementation from a written brief, then iterative debugging and behaviour changes driven by short, concrete prompts, on the backend first and on the web app and both together afterwards. |
| **How it was kept in check** | A standing rules file (`CLAUDE.md`) the AI reads each session, plan-first for multi-file changes, automated tests with every behaviour change (JUnit on the backend, Vitest and Playwright on the web app), a live check through the gateway, and looking at the running UI in a browser. |
| **Where it needed correction** | Section 13: complaints that could not be reproduced, assertions that could not fail, a stale dev-server bundle, a wrong locator and a first reading of an ambiguous request that was wrong. |

## 2. How the work was run

- **Brief first.** One detailed prompt set the stack, services, security model and deliverables (section 3). The web app
  started from a plan that was approved with some questions still open; the defaults chosen for them are listed in
  section 8.
- **Persistent rules.** `CLAUDE.md` records the modules and ports, demo users, backend and frontend rules, the contracts
  between the two, testing conventions, working agreements and "known simplifications", so each session starts from the
  same constraints instead of re-deriving them.
- **Plan before multi-file changes.** Working agreement: for multi-file or behaviour-changing work, plan first (plan
  mode), update `CLAUDE.md`, then implement, and keep the documents in sync in the same change.
- **Definition of done, per half.** Backend: `./mvnw clean install` passes and a live check through the gateway behaves
  as documented. Web app: lint is clean, the unit tests pass, Prettier has been run, and the change has been looked at in
  a browser at desktop and phone width, light and dark. A change that crosses the two does both, plus the contracts table.
- **Specific prompts.** Naming the endpoint, the user, the exact message seen and how to prove the fix gave the fastest
  diagnosis.
- **Verify, don't trust.** Behaviour was confirmed against the running system, not only against the code (section 12).
- **The user decides what is theirs to decide.** Where a request would change a rule (an officer creating a manager, a
  conversion rate nobody can supply) the AI said so and asked, and where the user then chose, the choice was recorded in
  `CLAUDE.md` with "do not change this without asking".

## 3. Phase 1: Initial brief

The brief, stated as the backend was built and as `CLAUDE.md` describes it (the table below lists where this departs from
the original wording):

> A Claims Management System for Chubb APAC in Java 21, Spring Boot 3.3.5 and Spring Cloud 2023.0.3, as a Maven
> multi-module build. A reactive Spring Cloud Gateway (8080) fronts three services: `user-service` (8081; claimants,
> officers and managers, plus login), `claim-service` (8083) and a stateless `workload-service` (8084, no database). A
> shared `common` library holds security, exception handling, Feign and OpenAPI configuration. There is no service
> discovery; services call each other at fixed URLs through OpenFeign. Spring Security with username/password login
> that issues a stateless JWT (HS256, 120 minutes by default) and role-based authorization for `CLAIMANT`, `OFFICER` and
> `MANAGER`. JPA on in-memory H2 by default or MySQL, one database per service. Springdoc Swagger UI on the gateway.
> Claim creation, retrieval, assignment to officers, a status workflow with a `claim_history` row for every state
> change, officer workload (claims in progress) against capacity, validation, centralized exception handling, JUnit 5 +
> Mockito tests, and `CLAUDE.md`, `README.md`, `architecture.md` and `test-payloads.json`.

**Outcome:** Maven multi-module project (`common`, gateway and domain services), layered code
(controller → service → repository), global exception handler, claim state machine, history audit, tests, docs.

### Where the result differs from the brief

| Original brief | Built | Consequence |
|----------------|-------|-------------|
| Separate Claimant and Staff services | One `user-service` for all roles; the role decides which profile fields apply | One login and one place for roles and officer capacity; the `users` table has role-specific nullable columns |
| Username/password security | Username/password login that issues a JWT (see phase 3) | Stateless; see limitations in section 14 |

## 4. Phase 2: Running and operating the system

- "Stop this project's four services, rebuild all modules with `./mvnw clean install`, then start exactly one set of them
  (user, claim, workload, gateway) with output redirected to `%TEMP%\cms-logs`. Don't report success until
  `/actuator/health` returns 200 on 8080, 8081, 8083 and 8084 and the Java process count shows no double start."
  (repeated after almost every code change; the first wording said "stop every Java process", which was replaced once it
  was clear that IntelliJ shares `java.exe` on this machine, see section 15)
- "List every demo user with username, password, role and user id in seed order, and say which ids are valid as
  `assignedOfficerId` and what status code and message the others return."
- "Walk through the claimant journey through the gateway on :8080 as runnable steps: log in for a JWT, submit a claim,
  read it back, and show the 403 when a claimant requests another claimant's claim. Give both the curl commands and
  the Swagger UI steps (Authorize with the token, without the `Bearer ` prefix)."
- "For each service that owns a database, give the H2 console URL, JDBC URL and credentials, and confirm that
  `workload-service` has no database."

**Outcome:** a repeatable Windows start/stop procedure (`backend-claim-management/scripts/start-all.ps1`; exactly one set
of four jars, health checks on 8080/8081/8083/8084, logs of hidden services in `%TEMP%\cms-logs`), a demo-user table, H2
console URLs, and curl and Swagger walkthroughs in the README.

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
  migration, documented in `architecture.md` section 23.2.
- Claims also grew an **information request**: an officer or manager can put a claim `ON_HOLD` with a mandatory request,
  and only the owning claimant's reply resumes review. Workload counts `ON_HOLD` claims, because the officer still owns
  them. The status was renamed twice on the way: first `AWAITING_INFO`, then `MORE_INFO_REQUIRED`, now `ON_HOLD`. The
  rule and the MySQL rename note are in `CLAUDE.md` and `architecture.md` sections 7 and 23.2.
- Claims became **market-aware**: six APAC markets (`SG, HK, JP, TH, IN, ID`), a claimant-name check against the profile,
  per-market demo claims, and the claim's market stored as a snapshot. Phase 8 changes how the market is chosen.

## 7. Phase 5: Documentation

- `README.md`: architecture, demo users, API walkthrough, run instructions.
- `CLAUDE.md`: rules for working in the repo, kept in sync with each change.
- `test-payloads.json`: sample request bodies, including negative cases.
- `architecture.md`: design write-up generated from reading the source: component and sequence diagrams, security
  model, data ownership, claim lifecycle, trade-offs and known limitations.
- This journal.

Phase 9 later merges these into one set that covers the web app too.

## 8. Phase 6: The web app

A web front end was added to the finished backend. The work started in plan mode: the plan was read and approved, the app
was built to it, and the questions the approval left open were settled with defaults rather than asked again.

| Question left open | Default taken | Why |
|--------------------|---------------|-----|
| How does the browser reach the API without CORS changes? | A dev-server proxy for `/api` (`proxy.conf.json`) and an nginx `/api` proxy in production, so the app and the API share one origin | No backend change, and the gateway stays free of CORS |
| Should the app edit, deactivate or delete users? | No: it lists and registers users; the rest is API only | Kept to what was asked |
| Should the shared documents change? | Not at that point | The user had not asked; this is what phase 9 later did |

What was built, each piece checked in a browser as well as by tests:

- **Session.** Sign-in with the JWT kept in `sessionStorage` and sent only on calls to `/api`; the token carries the
  username, not the id, so the app reads `GET /api/users/me` afterwards. A warning five minutes before the token expires,
  and a clean sign-out when the server answers 401.
- **Claims.** List with filters, sort and paging done in the browser (the API has no paging), a detail page with the
  history timeline, a status dialog whose choices come from `claim-workflow.ts`, an assignment dialog for managers, and the
  claimant's reply to an information request.
- **Dashboard and workload** per role, and a profile page.
- **A thin HTTP layer.** `authInterceptor` and `errorInterceptor`, API classes that every call goes through, and one
  rule for who shows an error: the calling form, or a snackbar.
- **Server is the authority.** The workflow table and the role guard only decide what the UI *offers*; a 403 or 409 from
  the backend always wins and is shown. A 403 in the browser is therefore a result, not a bug.

## 9. Phase 7: Redesign

On 2026-10-28 the app's look was rebuilt as a design system, rather than restyled page by page:

- Tokens in one place (`styles.scss`: brand navy, surfaces, shadows, radius, motion, light and dark through
  `light-dark()`), Inter Variable self-hosted because the content security policy allows same-origin fonts only, shared
  pieces (`BrandMark`, `Avatar`, `StatusChip`, `StateMessage`) and global classes (`.page`, `.surface-card`, `.skeleton`).
- A split-screen sign-in, a sidebar with a blurred sticky top bar, skeleton loading states, and a phone-friendly claims
  list.
- **Status colours always carry an icon and a word**, so colour alone never carries meaning.
- Checked in Edge at 390px, 820px and 1440px in light and dark, with nothing scrolling sideways. This became the rule in
  `CLAUDE.md` for every later UI change.

## 10. Phase 8: Product changes driven by the user

Short requests, each with the same loop: reproduce or read the code first, say what was found, change the smallest thing
that does it, add a test, check it in the running system. Dates are 2026-10-28 and 2026-10-29. Five of these needed a
backend change, each authorised and planned first.

| Request (paraphrased) | What was found | Change | Checked by |
|-----------------------|----------------|--------|------------|
| "Managers can't see all claims, assign, or process the workflow." | Tested first: it **was** implemented. Likely causes of the report: the claims table was empty (it had been cleared at the user's request), Assign was only reachable inside a claim's page, and the empty states read "Claims you file will appear here". | An Assign/Reassign button on every row of the claims list, empty-state text that knows about staff, and a manager e2e spec | The manager spec from an empty database |
| "Managers should do the whole workflow without assigning an officer." | The backend required an officer first. **Backend change 1:** `ClaimStatus` lists `OPEN` → `UNDER_REVIEW`, and `claimForOfficer` refuses an unassigned claim that is no longer `OPEN` so an officer cannot take a manager's claim over. The claim keeps no officer and counts toward nobody's workload; a manager can still assign one later. | The change above, the list reads "A manager (no officer assigned)", the claims table's Assign column sticks to the right | Backend unit tests for the status table and the service, the manager e2e spec, the status-flow diagram redrawn |
| "Convert the claim currency automatically based on the selected country." | No exchange rates exist anywhere, so a conversion would show invented numbers. The AI asked; the user chose each country's own currency, no conversion. Declined: an approximate-USD line from fixed rates, and storing converted amounts (a backend change). | A `money` pipe and a market → currency table; yen and rupiah take whole numbers only | Unit tests for the pipe and the validator, `currency.spec.ts` |
| "Register users; the policy number should never be typed, take it from the claim or customer record, otherwise a dropdown." | The backend has no policy or customer records. First reading: the form fills the next `POL-<MARKET>-nnnn` and lists existing policies in a dropdown. A guess at an ambiguous request; replaced in the policy-number row below. | A `/users` list and `/users/new` form for staff | Unit and e2e tests |
| "Remove Claimant details, then Market, from New user; add a Roles dropdown; show Market only when creating a claim." | The user interrupted the AI's clarifying question, so it planned and used defaults. **Backend change 2:** a claimant's market and policy number became optional, a claim's market is the one sent, and a claimant who **has** a profile market (the demo claimants) stays locked to it. | New user has no Market or policy fields for any role; the New claim page's Market is a required dropdown unless the profile fixes it | The backend suite, unit tests, a live check as each role |
| "Show Person details first, then Role, with all three roles for officers too." | The AI had declined this earlier because an officer could then create an account more privileged than their own, and said so. The user asked for it with that in view. Planned first. | `UserService.create` no longer checks the caller (the controller gate `OFFICER`/`MANAGER` stays; update and delete stay manager-only). Recorded in `CLAUDE.md` as "do not fix without asking". | `user-service` tests, a live check |
| "Managers and officers don't see the fields a claimant sees." then "make the page behave like the claimant's" then "no claimant dropdown, show my own name". See [the New claim saga](#the-new-claim-saga). | Three rounds. The AI could not reproduce a failure (claims filed fine as every role), the user declined a multiple-choice question, and the plain-text answer was "it should look the same". **Backend change 3.** | One New claim page for every role: the signed-in user's name, a Market dropdown, and the request never carries a `claimantId`. `ClaimService.resolveClaimant` files in the caller's own name when no claimant is given. | A unit test that compares the two roles' labels, the own-name e2e tests |
| "I don't need the Officer details section." | **Backend change 4.** Capacity is load-bearing: `claim-service` and `workload-service` read `int maxCapacity`, so a missing one is 0 and the officer could never take a claim. Removing the form section alone would have broken assignment. | Specialization is optional and display only, capacity defaults to 5 (`DEFAULT_OFFICER_CAPACITY`) | A live check: an officer created with no details gets capacity 5 and can be assigned a claim |
| "The Policy Number should fill itself in on New claim." | **Backend change 5.** A claim had no policy number. | `claims.policy_number`, decided only by `ClaimService.policyNumberFor` (the profile's number, else `POL-<MARKET>-<user id padded to 4>`); the page shows a read-only preview from a mirror of the rule. **One table of examples sits in both `ClaimServiceTest` and `policy-number.spec.ts`**: change them together. | Both tests, and a live check that the number on the form equals the one on the claim page |
| "The login page scrolls vertically; I want a single page." | Measured, not guessed: `.login` used `min-height: 100dvh` and the brand column alone needed 883px, so any window shorter than that scrolled (most laptop windows are 650-800px). | `height: 100dvh`, spacing in `clamp()`, decoration dropped by window height, and the form panel as the only thing that may scroll | A script compares `scrollHeight` with `innerHeight` at 12 window sizes from 1920x960 to 360x600, in light and dark, with the error banner showing |
| "Change the login headline to something more professional." | The first rewrite wrapped to three lines. | "Claims resolved with clarity and control." and a one-sentence lede | Looked at in Edge at desktop and phone size |

### The New claim saga

It took three requests, so it is worth writing down. The first complaint could not be reproduced. Offering guesses did not
help, and the answer only came when the user was asked, in plain words, what they saw: they wanted the page to *look*
the same for a manager and an officer as for a claimant. That was a design request, not a defect. The second round
(a dropdown with no name in it) led to staff opening on the first claimant by name, which the AI flagged as a trade-off
(a careless submit files for someone else). The third round dropped the dropdown for good: staff file in their own name,
the option the AI had offered earlier, which is why it needed the third backend change. Two gaps follow from it and are
**accepted and documented, not fixed**: staff can approve or settle a claim they filed themselves, and an `ON_HOLD` request
on a staff-owned claim can only be closed, because the reply path belongs to claimants.

## 11. Phase 9: One repository, one set of documents

- **The repository moved up one level.** The user asked for the Git repository to be removed from
  `backend-claim-management/` and configured in the `chubb` folder with `https://github.com/Sivasankar1814/Chubb_assessment.git`.
  Rather than re-initialise, the existing `.git` was **moved**, which kept the history, branches, remote and stash. A
  dry run on a throwaway index showed what the move does to the tree: the backend files appear as renames, the web app as
  new files, and six old root paths collide with the IDE files the `chubb` folder already has, so those are untracked
  before committing.
- **The documents were merged, not duplicated.** The four documents moved to the repository root and were rewritten to
  cover both halves. The web app's own `README.md` and `CLAUDE.md` were merged in and removed, after a section checklist
  confirmed that nothing in them was dropped.
- **Pictures kept honest.** The system diagram gained the browser tier, the tech-stack banner gained the web app and its
  tooling, and three screenshots (sign-in, a claim with its history, workload) were taken in Edge after filing a short
  claim story through the API as the three demo users. The claims were then cleared again.
- **A risky line was replaced.** The old docs said to stop everything with `Get-Process java | Stop-Process -Force`. On
  this machine IntelliJ owns `java.exe` processes too, so the docs now say to stop the services by matching their command
  line (`-1.0.0.jar`).

## 12. How AI output was verified

- **Automated tests, backend** (JUnit 5, Mockito, AssertJ): claim state machine, claim service rules, repositories on H2
  (`@DataJpaTest`), user and auth services, controller security and validation (`@WebMvcTest` with a mocked JWT), and a
  full login-to-token flow (`AuthFlowIntegrationTest`, `@SpringBootTest`). Tests are added or updated with every
  behaviour change, and `./mvnw clean install` must stay green.
- **Automated tests, web app:** Vitest unit tests next to the code (guards, interceptors, pipes, the workflow and
  policy-number mirrors, dialogs and pages), and Playwright end-to-end specs in Edge against the real backend
  (`access`, `currency`, `lifecycle`, `manager`, `users`). Each e2e test files its own claim so runs repeat; a serial
  lifecycle spec shares one claim across roles on purpose.
- **Live check:** `/actuator/health` returns 200 on 8080, 8081, 8083 and 8084, then a login through the gateway and the
  affected endpoints. For example, `GET /api/workload` as a manager crosses services and exercises the gateway,
  workload, user and claim services together. Scripted calls go to `:8080` directly: through the dev proxy on `:4200`,
  Windows PowerShell 5.1 sometimes got a spurious 502, which real browser logins never did.
- **Looking at it.** UI changes were opened in Edge at 390px, 820px and 1440px, light and dark. Layout claims were
  measured (scroll height against window height at many sizes) rather than eyeballed.
- **Process hygiene:** after every start, count the Java processes to catch a double start.
- **Auth problems:** reproduce with a raw HTTP client first, then the browser, to separate server bugs from client
  state.
- **Review of the finished system:** `architecture.md` was produced by reading the code rather than the README, which
  surfaced the limitations in section 14.
- **The documents themselves.** A script checks every relative link, image and `#anchor` across the four documents, and the
  facts in them (ports, versions, npm scripts, folder tree, demo users) were compared with the code.

## 13. Where AI needed correction

| What happened | What it taught |
|---------------|----------------|
| **A complaint that could not be reproduced** (the staff New claim page, three rounds). The AI kept testing and guessing. | When it cannot reproduce, ask for a description in plain words, not a multiple-choice question; the user's answer was about looks, not behaviour. |
| **A first reading of an ambiguous request.** "Take the policy number from the claim or customer record, otherwise a dropdown" became a form that invented `POL-<MARKET>-nnnn` and listed existing policies. | The backend had no such records, so the reading was a guess. It was replaced after the user's later, clearer request. Say which reading is being taken. |
| **Assertions that could not fail.** Some tests looked for heading text that also contained an icon's ligature text, so a "does not contain" check passed for the wrong reason. | A "does not contain" test needs a matching "does contain" case that proves the helper finds anything. Now a rule in `CLAUDE.md`. |
| **A stale dev-server bundle.** Editing the `.ts` and `.html` of one component in separate steps made a rebuild fail halfway, and `ng serve` kept serving a mismatched bundle (`ctx.x is not a function`). It looked like a code bug twice. | Look for "Application bundle generation complete" in the log and restart `ng serve` before debugging. |
| **A wrong locator.** A `div` filtered by its `dt` returned the first `dd` of the whole definition list. | Take the `dt` and then `following-sibling::dd[1]`. Now a rule in `CLAUDE.md`. |
| **End-to-end timeouts under load.** A currency test timed out when other programs ran, and passed alone. | The suite has a 60-second limit per test and one worker; run it on a quiet machine. |
| **A clipped heading.** On the phone login, a negative margin pulled the card above a scroll container, where it was clipped. | Do not pull content above a scroll container with a negative margin; move the container instead. |
| **A headline that wrapped to three lines.** | Reword, then look at it at narrow widths before calling it done. |
| **A risky stop recipe.** The early docs and habits killed every Java process, which on this machine also takes down IntelliJ. | Match the service command line instead; the recipe is in `CLAUDE.md` and the README. |
| **A form change that would have broken assignment.** Removing the Officer details section looked frontend-only. | Check what reads a field before removing it: capacity was `int` downstream, so null meant 0 and a permanently full officer. |

## 14. Known limitations

These are acceptable for a local demo and would be addressed before production. The full list, with the web app's items,
is `architecture.md` section 23.

- **Capacity check is not atomic.** Assignment counts open claims and then saves, with no locking, so two simultaneous
  assignments can exceed an officer's capacity.
- **No referential integrity across services.** Deleting a user does not check the claims that reference them.
- **Default JWT secret and open H2 console.** The secret has a demo default in source (every service must share the same
  `CHUBB_SECURITY_JWT_SECRET` outside local use), and `/h2-console/**` is on the public path list of every service that
  uses `common`.
- **No resilience layer.** No retries, circuit breakers or explicit Feign timeouts.
- **No token revocation, refresh tokens or self-service password change.** The web app's session ends at the token's
  expiry, and the token lives in `sessionStorage`, readable by scripts on the page (hence the strict content security
  policy).
- **No service discovery.** Services and the gateway call each other at fixed URLs (`services.<name>.url`, defaulting to
  localhost:8081-8084).
- **One `users` table** holds claimants, officers and managers; the role decides which profile columns apply.
- **Data resets on restart.** The default database is in-memory H2, so users, claims and ids are recreated by the demo
  data seeder every time.
- **Schema comes from `ddl-auto=update`**, with no migration tool; a new enum value needs an `ALTER` on MySQL.
- **The claims list is fetched whole** and filtered, sorted and paged in the browser, because the API has no paging.
- **Currency is a label, not a conversion.** The backend stores a bare amount and the claim's market says which currency
  it is in.
- **Two accepted gaps from product decisions:** staff can approve or settle a claim they filed themselves, and an officer
  can create a manager account.
- **Not exercised end to end:** the Docker image for the web app has not been built or run, and the full Playwright suite
  was not completed in one clean run after the last round of changes (the specs touched by them were run on their own).
  The suite needs the nine seeded users and the demo claims; it fails against the three-user, no-claims state the
  system was last left in at the user's request.

Suggested next steps: optimistic locking on claims, an identity provider with asymmetric token validation and a refresh
flow, server-side paging for the claims list, service discovery, and retries and circuit breakers on Feign calls.

## 15. Lessons learned

- Spring Boot fat jars are not repackaged when only `common` changes: use `./mvnw clean install`.
- Stop this project's services before rebuilding (locked jars) and check the process count after a start (double
  starts). Where `java` resolves to the Oracle launcher stub, each service shows as two processes, so 4 services means 8.
  Match the services by command line: killing every `java.exe` also kills an IDE.
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
- **The server is the authority.** The web app holds copies of a few rules so it offers only what works, but a 403 or 409
  from the backend is a result to show, and the copies are kept equal by test examples that both sides share.
- **Reproduce before changing, and when you cannot, ask in plain words.** Three rounds on one screen cost more than one
  direct question would have.
- **Measure layout, do not eyeball it.** Comparing `scrollHeight` with `innerHeight` across window sizes found the cause of
  the scrolling login page that looking at one window had missed.
- **Check what depends on a field before removing it from a form.** The UI is rarely the only reader.
- **Say when a request would change a rule, and record the answer.** The two accepted gaps are in `CLAUDE.md` with "do not
  fix without asking", so a later session does not quietly undo a decision the user made knowingly.
- **A test must be able to fail.** Pair every "does not contain" with a "does contain".
- **Say what was not verified.** The Docker image and a full clean end-to-end run are listed as gaps above rather than
  assumed to work.

## 16. Related files

- `README.md`: the front door: screens, quick start, demo users, how to run and use both halves, troubleshooting
- `architecture.md`: design, security, data ownership, the web app's structure, contracts between the halves, trade-offs,
  limitations
- `CLAUDE.md`: rules for working in this repo, backend and web app
- `backend-claim-management/test-payloads.json`: sample request bodies, including negative cases
- `backend-claim-management/scripts/start-all.ps1`: builds and launches all four services on Windows
- `frontend/scripts/start-frontend.ps1`: starts the web app's dev server on :4200
- `docs/`: the diagrams embedded in the documents (`tech-stack`, `system-architecture`, `claim-status-flow`) and the
  screenshots in `docs/screens/`
