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

---

## ADR-007: Mobile Dashboard Shows Only What `GET /api/dashboard/summary` Actually Returns

**Status:** Accepted

### Decision

The Home screen's data is a direct, unmodified read of the existing `GET /api/dashboard/summary` response via TanStack Query — no new backend endpoint, no backend changes. Several elements the Mobile Home design reference shows are deliberately **not** rendered, because no combination of real fields in that response can honestly represent them:

- **Attendance is Present/Absent only** (+ the rate the backend already computes), not the four-way On time/Late/Absent/Leave breakdown the mockup shows. The schema only ever models `PRESENT`/`ABSENT` (see `docs/database.md`); inventing "Late" or "On Leave" would mean inventing a business concept that doesn't exist yet.
- **No store-filter chips.** `dashboard.schemas.ts` accepts only `startDate`/`endDate` — there is no `storeId` query parameter to filter by, and a `STORE_MANAGER`'s scope is already fixed server-side. Adding store filtering would mean changing the backend's query contract, which this milestone's ticket explicitly said to avoid unless genuinely required — and it isn't, for a foundation dashboard.
- **No notification bell, no "Needs attention" correction list.** The summary response has no notification data and no per-item attendance-correction list (only a future Corrections module would have per-item detail) — nothing to show here would be real.
- **No "Processing" payroll status.** `Payroll.status` is `DRAFT` or `FINALIZED` only; the design's "Processing" badge doesn't correspond to any state the backend tracks. The screen instead shows the real `finalizedTotal`/`draftTotal` split.
- **The greeting uses the organization's name, not a person's name.** `User` (the login identity an `ORGANIZATION_ADMIN`/`STORE_MANAGER` authenticates as) has no `name` field, only `email` — see ADR-005, where the workforce identity (`Employee.name`) was deliberately kept separate from the login identity. Displaying a fabricated name would violate the same principle that ADR-005 established.

### Reason

The milestone ticket is explicit: "Use ONLY real data returned by the Dashboard API. Do not invent metrics... if it cannot [be derived], do not fake it — omit it or use a sensible non-misleading treatment." A dashboard that silently fabricates or mislabels numbers is worse than one that shows less — it erodes trust in every other number on the same screen.

### Alternatives Considered

- Approximating "Late" as some derived heuristic (e.g., attendance marked after a cutoff time) — rejected; `Attendance` has no check-in *time* field at all, only a status and a date, so there is no real signal to derive "Late" from.
- Adding a `storeId` filter to `GET /api/dashboard/summary` to support the design's store chips — rejected for this milestone; it's a genuine backend contract change (new query param, new scoping logic) the ticket said to avoid unless the mobile dashboard "genuinely cannot" work without it, and it can — org-wide is a perfectly valid V1 view.
- Showing the design's four-color attendance bar anyway with "Late"/"Leave" segments hardcoded to zero — rejected; a permanently-zero segment in the UI implies tracking that isn't happening, which is its own kind of misleading.

### Trade-offs

- The Home screen is visually simpler than the design mockup — fewer cards, no store switcher, no live correction feed. That gap closes naturally as the Attendance Corrections and Notifications features get their own mobile milestones with real backing data, not by front-loading fake UI now.

---

## ADR-008: Mobile Employees Module — Real Fields Only, Backend Roles Are the Only Authorization System

**Status:** Accepted

### Decision

The mobile Employees list/detail/create/edit screens show and accept only fields that actually exist in the backend's `Employee`/`Store` models, and role-gate every mutating action by mirroring — never re-deriving — the backend's own route permissions:

1. **List item content.** The design reference's employee row shows an `EMP-1042`-style code, a job title ("Sales Associate"), and a per-employee "22/23 days present this month" progress line. None of these exist in the `Employee` model, and the attendance figure specifically would require one attendance-aggregation call per employee (an N+1 pattern the milestone ticket explicitly forbade). All three are replaced with real, single-call fields: login-account status (`employee.user` present or not) and, for `ORGANIZATION_ADMIN`, the store name.
2. **Filter chips are All/Active/Inactive, not All/Active/On leave/Inactive.** `Employee.isActive` is the only lifecycle field that exists; "on leave" isn't a concept the schema has (an `Attendance` row's `ABSENT` status is a single day's fact, not an employee lifecycle state).
3. **Create/Edit are only ever shown to `ORGANIZATION_ADMIN`.** `POST /api/employees` and `PATCH /api/employees/:id` are `ORGANIZATION_ADMIN`-only routes (confirmed by reading `employee.routes.ts`, not assumed) — `STORE_MANAGER` can list and view employees in their own store but cannot create or edit any of them. The mobile UI simply never renders the "+" button or the "Edit" button for that role; it does not implement a second, parallel authorization system to decide this.
4. **The store picker (create/edit) calls `GET /api/stores`, which is `ORGANIZATION_ADMIN`-only entirely** — consistent with #3, since only that role ever reaches a screen that needs it. `STORE_MANAGER` has no endpoint anywhere that returns their own store's name (`/api/stores` and `/api/managers` are both gated to `ORGANIZATION_ADMIN`); the employee list/detail screens simply don't show a store name for that role rather than guessing one.
5. **The employee `qrCodeToken` is never fetched into a display path, logged, or rendered.** The milestone ticket explicitly said not to show it unless required, and QR functionality isn't part of this milestone.

### Reason

Same principle as ADR-007: a screen that fabricates data it doesn't have is worse than one that honestly shows less. The role-mirroring approach (rather than a separate mobile permissions model) avoids the two ever drifting out of sync — the backend route guards are the single source of truth for who can do what, and the mobile app already gets the authenticated user's role from the existing auth store, so mirroring it is a read, not a new system.

### Alternatives Considered

- Calling the Attendance/Reports endpoints per employee to populate the design's progress line — rejected; explicit N+1 anti-pattern the ticket called out, and attendance screens are out of scope for this milestone entirely.
- A separate mobile-side role/permission config (e.g., a table of `{role, action, allowed}`) — rejected; the backend's `requireRole(...)` calls on each route are already that table, and duplicating it client-side only creates a second place that can go stale.
- Adding a `GET /api/managers/me`-style endpoint so `STORE_MANAGER` could see their own store's name — rejected for this milestone as a backend change beyond what employee CRUD genuinely needs; noted as a legitimate future gap rather than worked around with a guess.

### Trade-offs

- A `STORE_MANAGER` sees "Your store" instead of an actual store name anywhere in the Employees module, since no endpoint gives them that name. This is a minor, honest UX gap, not a bug — the alternative (guessing or caching a name from some other screen) risks showing a stale or wrong store name with no way to know.