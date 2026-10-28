# Chubb APAC – Backend Claim Management

A microservices-based claims platform for filing, assigning and tracking insurance claims across six APAC markets, built
with **Java 21** and **Spring Boot 3.3**.

![Technology stack: Java 21 and Maven; Spring Cloud Gateway, springdoc-openapi and Actuator at the edge; Spring Boot 3.3.5, OpenFeign, Bean Validation and a shared common library in the services; Spring Security with OAuth2 resource server, JWT and BCrypt; Spring Data JPA with H2 or MySQL; JUnit 5, Mockito and Spring Boot Test](docs/tech-stack.svg)

A claimant files a claim, a manager assigns it to an officer with spare capacity, and the officer works it through a status
workflow that keeps a full audit trail. Everything goes through one gateway and is secured with JWT and three roles
(`CLAIMANT`, `OFFICER`, `MANAGER`).

This README covers setup and day-to-day use. How the system is built and why (service design, security model, data,
claim workflow rules, limitations) is in [architecture.md](architecture.md); rules for changing the code are in
[CLAUDE.md](CLAUDE.md).

## Services

| Module             | Port | Purpose                                                                |
|--------------------|------|------------------------------------------------------------------------|
| `api-gateway`      | 8080 | Single entry point: routing and an aggregated Swagger UI               |
| `user-service`     | 8081 | All users (claimants, officers, managers): profiles, roles, login and JWT issuing |
| `claim-service`    | 8083 | Claims, assignment, status workflow, history                           |
| `workload-service` | 8084 | Utilisation per officer, next-assignee suggestion                      |
| `common`           | –    | Shared library: security, exception handling, Feign auth, OpenAPI      |

## Prerequisites

* JDK 21 (`java -version`)
* Internet access on first build (Maven downloads dependencies). No local Maven needed – use `mvnw`.
* Optional: MySQL 8 for the `mysql` profile.

## Build & test

```powershell
.\mvnw.cmd clean install        # Windows   (./mvnw clean install on Linux/macOS)
```

Each service becomes a Spring Boot jar at `<module>/target/<module>-1.0.0.jar`. After editing `common`, run
`clean install`: the service jars are not repackaged when only a dependency changed.

JUnit 5 / Mockito tests run as part of the build (service logic, workflow rules, JPA repositories on H2,
controller security & validation via `@WebMvcTest`). The test inventory is in [architecture.md](architecture.md).

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

The start order is a convenience, not a requirement: a service boots even if the ones it calls are down, and calls to
them return 502 until they are up. Log in only after `user-service` is up.

Check http://localhost:8080/api/workload (log in as manager1) – a 200 means the gateway, workload, user and claim services are all reachable.
Every service also answers `/actuator/health` (8080, 8081, 8083, 8084).

### Using MySQL instead of H2

H2 (in-memory, MySQL compatibility mode) is the default and needs no setup; the demo users are seeded
on start-up. To use MySQL run `user-service` and `claim-service` with `--spring.profiles.active=mysql`.
Databases `user_db` and `claim_db` are created automatically; set the connection per process (see `DB_URL`,
`DB_USERNAME` and `DB_PASSWORD` under [Configuration](#configuration)). Tables are generated from the JPA entities; demo
users and demo claims are only seeded into empty tables.
H2 consoles are available at `http://localhost:808{1,3}/h2-console` (JDBC URL `jdbc:h2:mem:<userdb|claimdb>`, user `sa`).

## Configuration

The defaults work for a local run. Override them with environment variables or `application.yml`.

| Setting | Env var | Default | Applies to |
|---------|---------|---------|------------|
| `server.port` | – | 8080 / 8081 / 8083 / 8084 | each service |
| `chubb.security.jwt.secret` | `CHUBB_SECURITY_JWT_SECRET` | built-in demo value, min. 32 characters | user, claim, workload (**must be identical**) |
| `chubb.security.jwt.issuer` | – | `chubb-claims-auth` | same three |
| `chubb.security.jwt.expiration-minutes` | – | 120 | user-service (signs) |
| `services.user.url` | `SERVICES_USER_URL` | `http://localhost:8081` | gateway, claim, workload |
| `services.claim.url` | `SERVICES_CLAIM_URL` | `http://localhost:8083` | gateway, workload |
| `services.workload.url` | `SERVICES_WORKLOAD_URL` | `http://localhost:8084` | gateway |
| `chubb.seed-demo-users` | – | `true` | user-service |
| `chubb.seed-demo-claims` | – | `true` | claim-service (uses the demo user ids, so keep it in step with `seed-demo-users`) |
| `spring.profiles.active` | – | none (H2) | user, claim: `mysql` |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | same | per-service MySQL URL (`jdbc:mysql://localhost:3306/<db>`), `root` / `root` | user, claim, `mysql` profile only |

Set the JWT secret to the same value in every service and replace the built-in default outside local demos. Set both
`seed-demo-*` flags to `false` in production. Actuator exposes only `health` and `info`.

## Demo data

Demo users are created in the `users` table on first start (`chubb.seed-demo-users`). The user id is what other services
store (a claim's `claimantId`, its `assignedOfficerId`):

| Username    | Password      | Role       | Linked record                     |
|-------------|---------------|------------|-----------------------------------|
| `claimant1` | `claimant123` | CLAIMANT   | user id 1 (Aiko Tanaka, market JP) |
| `claimant2` | `claimant123` | CLAIMANT   | user id 2 (Wei Lim, market SG)    |
| `officer1`  | `officer123`  | OFFICER    | user id 3 (Priya Nair, cap. 5)    |
| `officer2`  | `officer123`  | OFFICER    | user id 4 (Daniel Chen, cap. 8)   |
| `manager1`  | `manager123`  | MANAGER    | user id 5 (Maria Santos)          |
| `claimant3` | `claimant123` | CLAIMANT   | user id 6 (Mei Chen, market HK)   |
| `claimant4` | `claimant123` | CLAIMANT   | user id 7 (Somchai Prasert, market TH) |
| `claimant5` | `claimant123` | CLAIMANT   | user id 8 (Arjun Mehta, market IN) |
| `claimant6` | `claimant123` | CLAIMANT   | user id 9 (Budi Santoso, market ID) |

**Demo claims.** `claim-service` also seeds 14 claims on first start (`chubb.seed-demo-claims`, set to `false` wherever the
demo users are off): a MOTOR and a PROPERTY claim in each of the six markets, plus a HEALTH claim (JP) and a TRAVEL claim
(SG), spread over every status from `OPEN` to `CLOSED` with their history. Log in, then `GET /api/claims` (as a manager or
officer) shows them all, and `?market=HK&claimType=PROPERTY` narrows them down.

## Using the API

### Logging in

`POST /api/auth/login` (username + password, public) returns an `accessToken`, a signed JWT valid for 120 minutes by
default. Send it as `Authorization: Bearer <token>` on every other call through the gateway. How tokens are issued and
validated is described in [architecture.md](architecture.md).

### Swagger UI

* **Aggregated, via the gateway:** http://localhost:8080/swagger-ui.html.
  1. Pick **user-service** in the top-right dropdown, run `POST /api/auth/login` with a demo user and copy the `accessToken`.
  2. Click **Authorize**, paste the token (no `Bearer ` prefix), click **Authorize** then **Close**.
  3. Switch to any other service in the dropdown and use **Try it out**; the token is remembered across reloads
     until it expires (then log in again).
* Per service: http://localhost:8081/swagger-ui.html (user), `:8083` (claim), `:8084` (workload).

### Who can call what

| Endpoint                                   | CLAIMANT         | OFFICER                        | MANAGER |
|--------------------------------------------|------------------|--------------------------------|---------|
| `POST /api/claims`                         | own claim        | on behalf of claimant          | ✔       |
| `GET /api/claims`, `/{id}`, `/{id}/history`| own claims only  | all                            | all     |
| `PUT /api/claims/{id}/assignment`          | ✖                | ✖                              | ✔       |
| `PATCH /api/claims/{id}/status`            | own claim, only to answer an information request | only claims assigned to them | ✔ |
| `POST /api/auth/login`                     | ✔ (public)       | ✔ (public)                     | ✔ (public) |
| `GET /api/users/me`, `/api/users/{id}`     | own profile only | any user                       | any user |
| `GET /api/users?role=&active=`             | ✖                | ✔                              | ✔       |
| `POST /api/users`                          | ✖                | claimants only                 | any role |
| `PUT / DELETE /api/users/{id}`             | ✖                | ✖                              | ✔       |
| `GET /api/workload`, `/{officerId}`       | ✖                | ✔                              | ✔       |
| `GET /api/workload/suggestion`             | ✖                | ✖                              | ✔       |

The claim status workflow, markets, history and workload rules behind these endpoints are in
[architecture.md](architecture.md). Errors share one JSON shape (`timestamp`, `status`, `error`, `message`, `path`,
`details[]`); the status codes are listed there too.

### Example walkthrough (through the gateway)

```bash
# 0. log in as each user (the response contains "accessToken"; here extracted with sed, or use jq -r .accessToken)
login() { curl -s -H "Content-Type: application/json" -X POST http://localhost:8080/api/auth/login \
  -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'; }
CLAIMANT=$(login claimant1 claimant123); MANAGER=$(login manager1 manager123); OFFICER2=$(login officer2 officer123)

# 1. claimant files a claim (claimant id is taken from the logged-in user; name and market must match their profile)
curl -H "Authorization: Bearer $CLAIMANT" -H "Content-Type: application/json" -X POST http://localhost:8080/api/claims \
  -d '{"claimantName":"Aiko Tanaka","market":"JP","claimType":"MOTOR","description":"Rear-ended at lights","claimAmount":1500.00,"incidentDate":"2026-10-01"}'

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

## Project layout

```
backend-claim-management/
├── pom.xml                 parent POM (Boot 3.3.5, Spring Cloud 2023.0.3, module list)
├── common/                 shared auto-configuration (JWT validation, exception handler, Feign, OpenAPI)
├── api-gateway/            routes and aggregated Swagger UI (application.yml)
├── user-service/           all users, login and token signing
├── claim-service/          claims, assignment, status workflow, history
├── workload-service/       stateless utilisation calculation
├── docs/                   diagrams (SVG, each with a 2x PNG export)
├── scripts/start-all.ps1   Windows build-and-launch script
└── src/Main.java           IntelliJ template file; not part of any module
```

The package structure inside each service is described in [architecture.md](architecture.md).

## Troubleshooting

* **`JAVA_HOME` not defined / wrong Java** – Maven needs a JDK 21 (`$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"`).
* **502 / connection refused from a service** – the downstream service is not started yet (or runs on another port). Service URLs default to `localhost:8081-8084`; override with `services.user.url`, `services.claim.url`, `services.workload.url`.
* **Port already in use** – change `server.port` in the service's `application.yml`.
* **Build fails because a jar is locked, or two sets of services are running** – running jars lock their files and a double
  start leaves two sets of processes on the same ports. Stop everything with `Get-Process java | Stop-Process -Force`
  before rebuilding or restarting. Where `java` on `PATH` is the Oracle launcher stub
  (`...\Common Files\Oracle\Java\javapath`), each service shows as two `java` processes (stub plus JVM), so expect 8 for
  4 services.
* **Where are the logs?** – On the console. When the services are started hidden with redirected output, look in
  `%TEMP%\cms-logs\<service>.out.log` and `.err.log`.
