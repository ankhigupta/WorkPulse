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

---

## ADR-006: Mobile Foundation — React Navigation over Expo Router, Custom Components over React Native Paper, SecureStore-Only Refresh Tokens

**Status:** Accepted

### Decision

Three related choices made while scaffolding `mobile/`:

1. **Navigation is React Navigation (native-stack + bottom-tabs), not Expo Router.** `create-expo-app` scaffolds its own `mobile/AGENTS.md` recommending Expo Router (file-based routes under `src/app/`) for new Expo projects. That's Expo's generic default advice, not this project's — the milestone ticket explicitly specifies React Navigation and a manually-defined Auth stack / bottom-tab app stack, matching the design reference's own navigation structure (Home / Attendance / Employees / Payroll / More).
2. **Foundational UI components (`AppButton`, `AppInput`, `AppCard`, etc.) are hand-built on plain React Native primitives, not React Native Paper components.** Paper is still installed and wraps the app in a themed `PaperProvider`, so later screens can reach for its richer widgets (`Menu`, `Snackbar`, `DataTable`) without re-theming — but Paper's Material Design ripple/elevation defaults would fight the flat, custom Charcoal + Burnished Copper look the design reference establishes, and only ~12 primitives were needed for this milestone anyway.
3. **The refresh token is the only piece of auth state persisted across app restarts, and it lives only in `expo-secure-store`.** The access token and hydrated user live in the Zustand store in memory only, rebuilt from the refresh token via `/api/auth/refresh` + `/api/auth/me` on cold start (`authStore.bootstrap()`). No token or user data ever touches AsyncStorage or a `zustand/persist` middleware, which would write to plain, unencrypted storage.

### Reason

1. The ticket is the authoritative instruction for this specific app; a scaffolding tool's generic template advice doesn't override it, and Expo Router's file-based-route convention would have meant a materially different (and unrequested) navigation architecture.
2. Matching the finalized design pixel-for-pixel (exact colors, radii, spacing from the design system reference) is far more direct against unstyled RN primitives than against a component library with its own opinionated defaults to override everywhere.
3. `Employee`s can exist without login (ADR-005), but every `User` who *does* log in still has a real password-backed session; the refresh token is a long-lived bearer credential and deserves Keychain/Keystore-backed storage, not just "not literally the password."

### Alternatives Considered

- Expo Router — rejected for this milestone; conflicts with the ticket's explicit React Navigation requirement.
- Building every primitive on top of React Native Paper's components — rejected; kept Paper installed and themed for future use instead, since forcing every custom design detail through Paper's theming API would add friction for no benefit at this stage.
- Persisting the access token too (for a snappier cold start) — rejected; the access token is short-lived (15m) and cheap to reacquire via one `/api/auth/refresh` call, so there's no real benefit to persisting it that would justify holding another bearer credential in storage.

### Trade-offs

- Cold start always costs one network round trip (`/api/auth/refresh` + `/api/auth/me`) before the app is usable, even if the access token from the last session technically hadn't expired yet.
- Node 22 LTS is used for the mobile toolchain instead of the backend's Node 24, since Expo/Metro compatibility with a Node major that new hasn't been validated upstream yet — the two apps don't need matching Node versions, so this costs nothing beyond remembering to `nvm use 22` in `mobile/`.