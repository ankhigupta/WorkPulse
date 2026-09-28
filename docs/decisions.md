# Architecture Decisions

---

## ADR-001: Monorepo Structure

**Status:** Accepted

### Decision

WorkPulse will use a monorepo containing separate backend and mobile applications.

### Reason

- Easier project management
- Single GitHub repository
- Shared documentation
- Better portfolio presentation
- Easier future CI/CD setup

### Alternatives Considered

- Separate repositories for backend and mobile

---

## ADR-002: Feature-Based Architecture

**Status:** Accepted

### Decision

The backend will use feature-based modules instead of separating code by controllers, services, and routes.

### Reason

Each business feature (Employees, Attendance, Payroll, etc.) remains self-contained, making the project easier to maintain and scale.

---

## ADR-003: Use tsx for Development

**Status:** Accepted

### Decision

Use `tsx` instead of `ts-node-dev` to run the development server.

### Reason

- Better compatibility with modern TypeScript versions
- Faster startup
- Actively maintained
- Simpler configuration

### Alternatives Considered

- ts-node-dev

### Trade-offs

Requires a newer Node.js version (which our project already uses).

---

## ADR-004: Testing Strategy — Vitest + Supertest + Dedicated Postgres Test Database

**Status:** Accepted

### Decision

Use Vitest (not Jest) with Supertest for HTTP integration testing, against a dedicated `workpulse_test` PostgreSQL database — not Docker/Testcontainers, not a mocked Prisma client.

### Reason

- Vitest's esbuild-based transform matches the project's existing `tsx`/esbuild toolchain and tolerates bleeding-edge TypeScript 7 far better than Jest's `ts-jest` transform.
- Real integration tests against a real database catch more than mocked-Prisma unit tests would, especially for behavior the composite tenant-integrity foreign keys are responsible for — those constraints only mean anything when tested against real Postgres.
- Local Postgres already runs and already hosts `workpulse`; standing up a second local database (`workpulse_test`) is simpler than introducing Docker/Testcontainers, and nothing about this project's test needs requires container isolation yet.

### Alternatives Considered

- Jest — rejected due to `ts-jest` friction with TypeScript 7 and heavier config for marginal benefit over Vitest here.
- Mocking Prisma entirely — rejected; would hide exactly the kind of bug (a broken composite FK, a bad cascade rule) this schema's tenant-isolation design most needs to catch.
- Docker/Testcontainers — deferred; no concrete reason local Postgres can't provide a clean, fast test database at this project's current size.

### Trade-offs

Test files run serially (`fileParallelism: false`) rather than in parallel workers, since they share one physical test database. Negligible cost at the current suite size; would need revisiting (per-test transactions, or containerized per-worker databases) if the suite grows much larger.

---

## ADR-005: Employee Is a Workforce Identity, Independent of User (Login Identity)

**Status:** Accepted

### Decision

`Employee.userId` is optional. An `Employee` (a workforce record — name, store, wage, attendance/payroll/payment history) can exist with zero linked `User` (a login account). `Employee.name` is a new required field and is the employee's real identity — never derived from `User.email`. `User.email` remains required and non-nullable; only the `Employee → User` relationship became optional, not `User` itself.

### Reason

Real employees at small businesses often have no phone, no email, and no smartphone, and will never log into WorkPulse. They still need full workforce records: attendance (recorded manually by their `STORE_MANAGER`), payroll, payments, notes, and reports. Requiring a `User` for every `Employee` made this structurally impossible — the only way to create an "employee with no account" was to fabricate a fake email, which is not a real identity and pollutes the `User` table with accounts nobody will ever log into.

### Alternatives Considered

- Make `User.email` nullable instead — rejected outright per explicit instruction; `User` represents authentication identity, and an account with no email isn't a coherent login identity. The correct fix is making the *relationship* optional, not weakening what a `User` means.
- Keep `Employee.userId` required and auto-generate a placeholder email per employee — rejected; this doesn't solve the actual problem (an employee still wouldn't have a real login, just a fake, unusable one) and adds confusing noise to the `User` table.

### Trade-offs

- Every service that previously assumed `Employee.user` exists had to be checked; in practice, only the Reports module actually depended on it (for `employeeName`, now `Employee.name` directly) — Attendance, Payroll, Payments, and EmployeeNotes never touched `Employee.user` at all, so the blast radius was smaller than it first appeared.
- The migration backfills `name` from each existing employee's `User.email` as a one-time convenience value for rows that predate this change — documented explicitly as not a real name, not a long-term identity source. There were zero existing `Employee` rows in this database when the migration ran.
- `POST /api/employees` now supports two shapes (with or without `email`+`password`) instead of one — validated via a Zod refinement requiring both fields together or neither, rather than two separate endpoints, to avoid the invitation/account-provisioning system explicitly out of scope for this milestone.