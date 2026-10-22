# AI Journal

High-level log of the prompts given to Claude Code while building the Chubb APAC Claims Management System, what each
one led to, and what was learned. Prompts are paraphrased and grouped by phase.

## 1. Initial brief

> Develop a Claims Management System for Chubb APAC using Java 21, Spring Boot 3 and microservices. Separate services
> for Claim, Claimant, Staff and Workload management, with Spring Cloud Gateway and Eureka. Spring Security with
> username/password and role-based authorization for claimants, staff and managers. JDBC with MySQL or H2. OpenFeign
> between services, Springdoc Swagger UI. Claim creation, retrieval, staff assignment, status management, history
> tracking, workload calculation, validation, centralized exception handling, JUnit 5 + Mockito tests, setup
> instructions, CLAUDE.md and README.md.

**Outcome:** Maven multi-module project (`common`, gateway and four domain services), layered code, global exception
handler, claim state machine, history audit, tests, docs.

## 2. Running and operating the system

- "run all services" / "stop all services and start each service" (asked many times)
- "provide all credentials" / "provide step by step how to use the project"
- "how do claimants submit claims, step by step"
- "h2 database urls"

**Outcome:** repeatable Windows start/stop procedure (exactly one set of four jars, health checks on 8080/8081/8083/8084),
demo-user table, H2 console URLs, curl and Swagger walkthroughs in the README.

## 3. Debugging prompts

- "/api/claims/2/assignment ... it's displaying validation failed" -> request body and role requirements explained.
- "swagger-ui.html shows a whitelabel error page" -> gateway redirect for `/swagger-ui.html`.
- "server URL still shows 8083" -> `PreserveHostHeader` on the docs routes.
- "authorization required / 401 unauthorized even after login" (reported repeatedly) -> investigated with curl and a
  headless browser; Basic auth pop-ups and Swagger Authorize state were the cause.
- "what is the permanent solution" -> "implement jwt token" -> stateless JWT (HS256) issued by `user-service`,
  validated by every service through `common`.
- "User Aiko Tanaka is not a staff member" -> not a bug: user ids are shared across roles (staff ids are 3 and 4).

## 4. Behaviour changes

- "Staff should be able to process a claim even if the manager has not assigned it; implement 'Claim is not assigned to
  you'" -> staff status update on an unassigned claim picks it up (capacity-checked, history row written); a claim
  assigned to another staff member still returns 403 "Claim is not assigned to you".
- "When claim is submitted, status should be open" -> status `SUBMITTED` renamed to `OPEN` everywhere.

## 5. Working agreements

- "First update CLAUDE.md in plan mode, then proceed with changes" -> CLAUDE.md is updated first for multi-file work,
  and kept in sync with each change.
- "Create Ai_journal.md with high-level prompts and a test payload file" -> this file and `test-payloads.json`.

## Lessons learned

- Spring Boot fat jars are not repackaged when only `common` changes: use `./mvnw clean install`.
- Stop all Java processes before rebuilding (locked jars) and check the process count after a start (double starts).
- Verify auth problems with a raw HTTP client first, then the browser, to separate server bugs from client state.
- Short, concrete prompts that name the endpoint, user and observed message ("/api/claims/{id}/assignment ... User
  Aiko Tanaka is not a staff member") were the quickest to diagnose.
- Always check ids before blaming code: demo user ids reset on every restart.

## Related files

- `README.md` – architecture, users, API walkthrough
- `CLAUDE.md` – rules for working in this repo
- `test-payloads.json` – sample request bodies, including negative cases
