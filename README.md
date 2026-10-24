# Chubb APAC – Claims Management System

A microservices-based claims platform built with **Java 21**, **Spring Boot 3.3**, **Spring Cloud 2023.0**
(Gateway, OpenFeign), **Spring Security**, **Spring Data JPA** (H2 or MySQL) and **Springdoc OpenAPI**.

## Architecture

```
                         ┌────────────────────┐
   client ─────────────► │  api-gateway :8080 │  routes /api/** and aggregates Swagger UI
                         └─────────┬──────────┘
                                   │ fixed URLs (services.*.url properties)
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        user-service  ◄──────  claim-service ──►  workload-service
          :8081                   :8083   ◄──────      :8084
  (all users + login/JWT)
```

| Module             | Port | Responsibility                                                         | Database          |
|--------------------|------|------------------------------------------------------------------------|-------------------|
| `api-gateway`      | 8080 | Single entry point, routing, aggregated Swagger UI                     | –                 |
| `user-service`     | 8081 | **All users** (claimants, officers, managers): profiles, roles, capacity, active flag, login and JWT issuing | `userdb` / `user_db` |
| `claim-service`    | 8083 | Claims, assignment, status workflow, history                           | `claimdb` / `claim_db`       |
| `workload-service` | 8084 | Utilisation per officer, next-assignee suggestion                      | stateless (computed live) |
| `common`           | –    | Shared library: security, exception handling, Feign auth, OpenAPI      | –                 |

Each service owns its own database (database-per-service). Cross-service data is fetched through **OpenFeign**
(`claim-service → user-service`, `workload-service → user-service / claim-service`).
There is deliberately **one** service for every kind of user: a `users` table holds identity, password hash and role, and
the role decides which profile fields apply (claimants: country, policy number; officers: specialization, max capacity).

### Security

* **JWT bearer authentication** (Spring Security resource server) with **role-based** method security
  (`@PreAuthorize`). Log in once with `POST /api/auth/login` (username + password) to receive an HS256-signed token
  (default lifetime 120 minutes) carrying the username and roles, then send `Authorization: Bearer <token>` on every call.
  The gateway forwards the header and Feign calls propagate it, so the original caller's identity and role is enforced in
  every service. Services validate the token locally with the shared secret; only `user-service` ever sees a password
  (stored as a BCrypt hash; disabled users cannot log in).
* Configure the signing secret with `CHUBB_SECURITY_JWT_SECRET` (**same value in every service**, at least 32 characters;
  the built-in default is for local demos only) and the lifetime with `chubb.security.jwt.expiration-minutes`.
* Demo users are created in the `users` table on first start (`chubb.seed-demo-users`, set to `false` in production).
  The user id is what other services store (a claim's `claimantId`, its `assignedOfficerId`):

| Username    | Password      | Role       | Linked record                     |
|-------------|---------------|------------|-----------------------------------|
| `claimant1` | `claimant123` | CLAIMANT   | user id 1 (Aiko Tanaka)           |
| `claimant2` | `claimant123` | CLAIMANT   | user id 2 (Wei Lim)               |
| `officer1`  | `officer123`  | OFFICER    | user id 3 (Priya Nair, cap. 5)    |
| `officer2`  | `officer123`  | OFFICER    | user id 4 (Daniel Chen, cap. 8)   |
| `manager1`  | `manager123`  | MANAGER    | user id 5 (Maria Santos)          |

> The in-memory user store is deliberately simple for this exercise. For production, replace the lookup in
> `AuthService` in `user-service` with an identity-provider backed implementation (the users table already
> stores hashed passwords and an active flag).

### Access matrix

| Endpoint                                   | CLAIMANT         | OFFICER                        | MANAGER |
|--------------------------------------------|------------------|--------------------------------|---------|
| `POST /api/claims`                         | own claim        | on behalf of claimant          | ✔       |
| `GET /api/claims`, `/{id}`, `/{id}/history`| own claims only  | all                            | all     |
| `PUT /api/claims/{id}/assignment`          | ✖                | ✖                              | ✔       |
| `PATCH /api/claims/{id}/status`            | ✖                | only claims assigned to them   | ✔       |
| `POST /api/auth/login`                     | ✔ (public)       | ✔ (public)                     | ✔ (public) |
| `GET /api/users/me`, `/api/users/{id}`     | own profile only | any user                       | any user |
| `GET /api/users?role=&active=`             | ✖                | ✔                              | ✔       |
| `POST /api/users`                          | ✖                | claimants only                 | any role |
| `PUT / DELETE /api/users/{id}`             | ✖                | ✖                              | ✔       |
| `GET /api/workload`, `/{officerId}`       | ✖                | ✔                              | ✔       |
| `GET /api/workload/suggestion`             | ✖                | ✖                              | ✔       |

## Business rules

**Claim status workflow** (`ClaimStatus`):

```
OPEN ─► ASSIGNED ─► UNDER_REVIEW ─┬─► APPROVED ─► SETTLED ─► CLOSED
    │            │                      └─► REJECTED ─► CLOSED
    └────────────┴──► CLOSED
```

* Any other transition returns **409 Conflict** listing the allowed next statuses.
* `ASSIGNED` can only be reached through the assignment endpoint; rejecting a claim requires `remarks`.
* Assignment verifies the officer exists and is active, is not already the assignee, and has spare
  capacity (`open claims < maxCapacity`). Reassigning keeps the current status.
* **History**: every creation, assignment/reassignment and status change is appended to `claim_history`
  (who, when, from → to, remarks).
* **Workload**: open claims = claims in `ASSIGNED` or `UNDER_REVIEW`.
  `utilization % = open / maxCapacity × 100`; level `LOW` (<50), `MODERATE` (<80), `HIGH` (<100), `FULL` (≥100).

## Prerequisites

* JDK 21 (`java -version`)
* Internet access on first build (Maven downloads dependencies). No local Maven needed – use `mvnw`.
* Optional: MySQL 8 for the `mysql` profile.

## Build & test

```powershell
.\mvnw.cmd clean install        # Windows   (./mvnw clean install on Linux/macOS)
```

JUnit 5 / Mockito tests run as part of the build (service logic, workflow rules, JPA repositories on H2,
controller security & validation via `@WebMvcTest`).

## Run

**One command (Windows):**

```powershell
.\scripts\start-all.ps1                 # H2 in-memory
.\scripts\start-all.ps1 -Profile mysql  # MySQL
```

**Manually** – start in this order, each in its own terminal, from the repo root:

```bash
./mvnw -q -DskipTests install
java -jar user-service/target/user-service-1.0.0.jar
java -jar claim-service/target/claim-service-1.0.0.jar
java -jar workload-service/target/workload-service-1.0.0.jar
java -jar api-gateway/target/api-gateway-1.0.0.jar
```

Or `./mvnw -pl <module> spring-boot:run`.

Check http://localhost:8080/api/workload (log in as manager1) – a 200 means the gateway, workload, user and claim services are all reachable.

### Using MySQL instead of H2

H2 (in-memory, MySQL compatibility mode) is the default and needs no setup; the demo users are seeded
on start-up. To use MySQL run `user-service` and `claim-service` with `--spring.profiles.active=mysql`.
Databases `user_db` and `claim_db` are created automatically; override the connection with
environment variables `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (defaults: `jdbc:mysql://localhost:3306/<db>`,
`root` / `root`). Tables are generated from the JPA entities; demo users are only seeded into an empty users table.
H2 consoles are available at `http://localhost:808{1,3}/h2-console` (JDBC URL `jdbc:h2:mem:<userdb|claimdb>`, user `sa`).

## API documentation (Swagger UI)

* **Aggregated, via the gateway:** http://localhost:8080/swagger-ui.html.
  1. Pick **user-service** in the top-right dropdown, run `POST /api/auth/login` with a demo user and copy the `accessToken`.
  2. Click **Authorize**, paste the token (no `Bearer ` prefix), click **Authorize** then **Close**.
  3. Switch to any other service in the dropdown and use **Try it out**; the token is remembered across reloads
     until it expires (then log in again).
* Per service: http://localhost:8081/swagger-ui.html (user), `:8083` (claim), `:8084` (workload).

## Example walkthrough (through the gateway)

```bash
# 0. log in as each user (the response contains "accessToken"; here extracted with sed, or use jq -r .accessToken)
login() { curl -s -H "Content-Type: application/json" -X POST http://localhost:8080/api/auth/login \
  -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'; }
CLAIMANT=$(login claimant1 claimant123); MANAGER=$(login manager1 manager123); OFFICER2=$(login officer2 officer123)

# 1. claimant files a claim (claimant id is taken from the logged-in user)
curl -H "Authorization: Bearer $CLAIMANT" -H "Content-Type: application/json" -X POST http://localhost:8080/api/claims \
  -d '{"claimType":"MOTOR","description":"Rear-ended at lights","claimAmount":1500.00,"incidentDate":"2026-10-01"}'

# 2. manager asks which officer has capacity, then assigns the claim
curl -H "Authorization: Bearer $MANAGER" http://localhost:8080/api/workload/suggestion
curl -H "Authorization: Bearer $MANAGER" -H "Content-Type: application/json" -X PUT http://localhost:8080/api/claims/1/assignment \
  -d '{"officerId":4}'      # 4 = officer2 (Daniel Chen), a user id

# 3. the assigned officer works the claim
curl -H "Authorization: Bearer $OFFICER2" -H "Content-Type: application/json" -X PATCH http://localhost:8080/api/claims/1/status \
  -d '{"status":"UNDER_REVIEW","remarks":"Reviewing documents"}'
curl -H "Authorization: Bearer $OFFICER2" -H "Content-Type: application/json" -X PATCH http://localhost:8080/api/claims/1/status \
  -d '{"status":"APPROVED"}'

# 4. audit trail and workload
curl -H "Authorization: Bearer $CLAIMANT" http://localhost:8080/api/claims/1/history
curl -H "Authorization: Bearer $MANAGER" http://localhost:8080/api/workload
```

Errors share one JSON shape (`timestamp`, `status`, `error`, `message`, `path`, `details[]`):

| Situation                                   | Status |
|---------------------------------------------|--------|
| Bean-validation failure / malformed JSON    | 400 (field errors in `details`) |
| No, invalid or expired token / bad login    | 401    |
| Role or ownership violation                 | 403    |
| Unknown claim / claimant / officer            | 404    |
| Illegal status transition, capacity, duplicates | 409 |
| Downstream service failure                  | 502 (or the downstream 4xx) |

## Project layout

```
claims-management-system/
├── pom.xml                 parent POM (Boot 3.3.5, Spring Cloud 2023.0.3, modules)
├── common/                 shared auto-configuration (JWT validation, exception handler, Feign, OpenAPI)
├── api-gateway/
├── user-service/           all users: controller → service → JPA repository, entity/User, login + token signing
├── claim-service/          + client/ (Feign), entity/ (Claim, ClaimHistory), model/ClaimStatus workflow
├── workload-service/       + client/ (Feign), stateless calculation
└── scripts/start-all.ps1
```

## Troubleshooting

* **`JAVA_HOME` not defined / wrong Java** – Maven needs a JDK 21 (`$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"`).
* **502 / connection refused from a service** – the downstream service is not started yet (or runs on another port). Service URLs default to `localhost:8081-8084`; override with `services.user.url`, `services.claim.url`, `services.workload.url`.
* **Port already in use** – change `server.port` in the service's `application.yml`.
