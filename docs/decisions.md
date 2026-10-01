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

---

## ADR-009: Mobile Attendance — Manual-Only Create, No Method/Check-In UI, No Detail or Edit Screen

**Status:** Accepted

### Decision

The mobile Attendance create form asks for only three things: employee, date, and status (Present/Absent). Three things a fuller form could have included are deliberately left out:

1. **No method picker.** Every record this app creates is submitted with `method: "MANUAL"`, silently, with no UI control for it. QR capture (`method: "QR"`) has no scanner in this milestone — offering a picker with a QR option that does nothing when selected would be exactly the "fake QR workflow" the milestone ticket explicitly forbade.
2. **No `checkInAt` input.** The field is optional on the backend and nothing in the approved design references calls for a check-in-time entry in a manual attendance flow. Adding it would mean either accepting a bare time (ambiguous — today? the selected date? the device's timezone or the server's?) or building real date+time picker UI for a field with no demonstrated product need yet. The milestone ticket explicitly permitted omitting it under exactly this reasoning.
3. **No attendance detail screen, no edit screen.** `attendanceSelect` on the backend is a small, flat object (id, employeeId, storeId, date, status, method, checkInAt, markedByUserId, timestamps) — everything in it is already visible on the list card. A detail screen would show literally nothing a tap-through wasn't already showing. The only editable field via `PATCH /api/attendance/:id` is `method`, and since every mobile-created record is already `MANUAL` with no QR capture to convert from, there is no real scenario in this app where changing it would do anything useful. Building an edit UI for that would be "unnecessary editing UI" by the ticket's own explicit test.

Separately: status (`PRESENT`/`ABSENT`) is set only at creation, through the create form's toggle — there is no path anywhere in the mobile app that lets a caller flip an existing record's status via `PATCH`. That's not an oversight; the backend's `updateAttendanceSchema` doesn't accept a `status` field at all (status changes are reserved for the not-yet-built Attendance Corrections workflow), and the mobile UI doesn't try to work around that.

### Reason

Every one of these is the milestone ticket's own explicit guidance applied literally: "do not pretend QR scanning works," "if supporting check-in time creates unnecessary timezone complexity... omit it," "do not add unnecessary editing UI," and "do not bypass [the Attendance Correction] architecture." None of these are judgment calls beyond what was already specified — they're the specification.

### Alternatives Considered

- A method picker with QR disabled/greyed-out (rather than absent entirely) — rejected; a visibly-present-but-unusable option still implies QR capture is a real, almost-available feature, which it isn't in this milestone.
- A `checkInAt` field defaulting to "now" when the form is submitted — rejected; that's inventing a fact (the exact instant of submission is not necessarily when the employee actually checked in) rather than reporting one, and no design reference asked for it.

### Trade-offs

- An organization that starts using QR devices elsewhere would see those records correctly (method displays as "QR" on the card) but could never re-tag one as "MANUAL" or vice versa from the mobile app. Given no real workflow in this milestone would ever need that, this is judged a non-issue rather than a deferred gap.

---

## ADR-010: Mobile Corrections List Resolves Employee/Date via a Bounded 90-Day Join, Not Per-Record Fetches

**Status:** Accepted

### Decision

`AttendanceCorrection`'s backend response (`correctionSelect` in `attendanceCorrection.service.ts`) contains only `attendanceId`, `organizationId`, `requestedByUserId`, `reviewedByUserId`, `proposedStatus`, `reason`, `status`, `reviewedAt`, and timestamps — no employee name, no attendance date, no original/current attendance status, and no reviewer name. Showing a useful corrections list requires all three: who the correction is about, what date, and what the record currently says.

Rather than fetching `GET /api/attendance/:attendanceId` once per correction (real N+1 — a list of 50 corrections would be 50 extra requests), `CorrectionsListScreen` fetches `GET /api/attendance-corrections` and `GET /api/attendance` over the *same* trailing 90-day window (`startDate`/`endDate`, both endpoints already support these filters) and joins them client-side by `attendanceId` via a `Map`. This is exactly two bulk requests for the entire screen, regardless of how many corrections exist within the window.

`requestedByUserId`/`reviewedByUserId` are never resolved to a name at all — there is no endpoint that maps an arbitrary user id to a display name (no `/api/users/:id`, and the two closest candidates, `/api/stores` and `/api/managers`, are unrelated and `ORGANIZATION_ADMIN`-only besides). The UI shows "Requested {time}" / "Reviewed {time}" without a name attached, rather than showing a raw, meaningless UUID.

### Reason

The milestone ticket was explicit that the list must avoid N+1 requests while still showing employee name/date/current-status "where provided by the API" — the bounded join is the only approach that satisfies both: real data, resolved correctly, without a per-row request.

### Alternatives Considered

- One `GET /api/attendance/:id` call per visible correction — rejected outright as the literal N+1 pattern the ticket forbade.
- Showing corrections with no date/name context at all (just reason + status) — rejected; would have satisfied "avoid N+1" trivially but produced a far less useful screen than the ticket asked for, when a clean bulk-fetch alternative existed.
- An unbounded correction list (no date window at all) — rejected; without *some* bound, the paired `GET /api/attendance` fetch needed for the join would have no bound either, and "fetch all attendance ever" doesn't scale as an organization accumulates history. 90 days was chosen as a generous-but-bounded default for a workflow that's inherently about *recent* discrepancies, not a historical archive.

### Trade-offs

- A correction whose underlying attendance record falls outside the trailing 90-day window won't resolve to an employee name or date — it falls back to a plain "Attendance record" label. This is accepted as a rare edge case (corrections are meant to be reviewed promptly, not discovered months later) rather than solved with an unbounded fetch. A future milestone could widen the window, add a proper date-range filter to the corrections screen, or — the more durable fix — have the backend's `correctionSelect` include a light nested `attendance` relation, removing the need for a client-side join entirely.

---

## ADR-011: The Payroll Bottom Tab Is Not Registered At All for Non-ORGANIZATION_ADMIN Roles

**Status:** Accepted

### Decision

`AppNavigator` reads the authenticated user's role and conditionally omits the `<Tab.Screen name="Payroll">` entry entirely for anyone who isn't `ORGANIZATION_ADMIN` — the tab doesn't appear in the bottom bar, and the route doesn't exist in that session's navigator at all. This is different from every prior role restriction in this app: Employees and Attendance Corrections keep their tabs/screens visible for `STORE_MANAGER` and simply hide specific actions (Create/Edit buttons, Approve/Reject) that role can't perform. Payroll hides the whole entry point instead.

### Reason

The distinction tracks a real difference in the backend, not an arbitrary inconsistency: `payroll.routes.ts` gates its *entire* router with a single `router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN))` — there is no `STORE_MANAGER` capability anywhere in the Payroll API, not even read-only (contrast `attendance.routes.ts` and `employee.routes.ts`, both of which allow `STORE_MANAGER` through for at least GET). A `STORE_MANAGER` who landed on a Payroll tab would see nothing but a 403 on every possible action — there's no partial, legitimate view to show them, unlike Employees (they can view) or Corrections (they can view and create). Hiding the tab is the accurate reflection of "this role has zero standing in this module," not a UI choice made independently of the backend's own model.

### Alternatives Considered

- Keep the tab visible and show a 403/"not available" screen inside it for non-admins — rejected; this is strictly worse than not showing the tab at all; a tab that always leads to an error is a dead affordance, and the milestone ticket explicitly asked for "the smallest clean adjustment necessary so the UI does not present inaccessible payroll management."
- A generic `role`-to-`allowedTabs` config table — rejected as unneeded structure for what is, today, a single boolean check (`role === "ORGANIZATION_ADMIN"`) directly mirroring the one route guard that actually exists; introducing a config layer ahead of a second real use case would be speculative.

### Trade-offs

- If a future role ever needs *partial* Payroll access (unlikely given PROJECT.md's dashboard descriptions, which only ever surface wage data to Organization Admin), this all-or-nothing tab visibility would need to change to the same pattern used elsewhere (visible tab, gated actions) — a small, localized change, not a rearchitecture.

---

## ADR-012: Payment `paidAt` Is Always Submitted as Noon UTC on the Selected Calendar Date

**Status:** Accepted

### Decision

The mobile Record Payment form asks for a "Paid on" calendar date only — never a time of day. Whatever date is entered (today or backdated), the `paidAt` instant sent to `POST /api/payments` is always constructed as `${date}T12:00:00.000Z` — noon UTC on that date, every time, with no branching logic based on whether the date happens to be today.

### Reason

`PaymentLedger.paidAt` is a real timestamp on the backend (`z.coerce.date()`, no date-only constraint), but the product need here is simpler than that column: an admin recording a payment cares about *which day* it was paid, not the minute. Two tempting alternatives both introduce a real timezone bug class the milestone ticket explicitly warned about ("Do not silently convert a calendar date into the wrong instant"):

- Defaulting to `new Date()` ("now") only works correctly for today's date — applying it to a backdated entry would silently attach today's clock time to a past date, which is meaningless and confusing in the payment history.
- Defaulting to local midnight (`${date}T00:00:00` in the device's timezone) risks the well-established local-midnight problem this codebase has avoided everywhere else (see the UTC-safe date-only patterns throughout `utils/date.ts`/`utils/format.ts`): on a negative-UTC-offset device, local midnight can serialize to the *previous* UTC calendar date.

Noon UTC sidesteps both: it's a single, unconditional rule (not two rules picked based on which date was entered), and it's far enough from any real-world timezone's day boundary (offsets run from UTC−12:00 to UTC+14:00) that the calendar date the backend actually stores can never disagree with the one the admin typed.

### Alternatives Considered

- A full date+time picker — rejected; no design reference calls for one, and the milestone ticket explicitly said a calendar-date-only UX is acceptable when time selection isn't required by the product.
- Noon in the organization's local timezone instead of UTC — rejected; the mobile app has no concept of an organization's configured timezone anywhere (none of `User`/`Organization`/`Store` has a timezone field), so there is no such value to use even if this were otherwise preferable.

### Trade-offs

- Every payment's `paidAt` clock time reads as "noon" (in whatever timezone a future screen might display it in), which is a cosmetic artifact of this choice — nothing in the product currently displays or depends on that clock time being meaningful, only the calendar date, so this is accepted as a non-issue rather than a defect.

---

## ADR-013: Reports' Employee/Store Pickers Are a Shared `SelectField`, Breaking From the "Local Copy Per Form" Precedent

**Status:** Accepted

### Decision

Every prior milestone with a searchable employee-or-store picker (Attendance's create form, Payroll's create form, Payment's create form, Manager's create/edit form) implemented its own self-contained, near-identical modal-list picker component, deliberately kept local to that file rather than shared — each milestone's report explicitly reasoned that duplicating ~60 lines was safer than touching or coupling to already-shipped modules outside that milestone's scope.

The Reports module breaks from that: `SelectField` (`src/components/SelectField.tsx`) is a single generic single-select modal picker, used across all four report screens for their employee and/or store filters — at least six call sites within this one milestone alone.

### Reason

The "keep it local" reasoning in every prior ADR/doc note was specifically about not reaching back into *already-shipped* screens to refactor them — the risk being an edit to working, tested code outside the current milestone's actual scope. That reasoning doesn't apply to genuinely new code being written multiple times *within the same milestone*: writing the same ~60-line picker six times over in one sitting is exactly the duplication a shared component exists to avoid, without touching a single previously-completed file to get there. `AttendanceForm`, `PayrollCreateScreen`, `PaymentCreateScreen`, and `ManagerForm` all keep their own existing local pickers untouched — this doesn't retrofit them.

### Alternatives Considered

- A sixth-through-ninth local copy, one per report screen — rejected; past the point any reasonable "avoid touching other milestones' code" justification applies, since all six new call sites are being written in this same milestone with nothing external at stake.
- Refactoring the four existing local pickers to also use `SelectField` — rejected for this milestone; those files are complete, tested, and outside this ticket's scope ("do not rewrite completed modules"). `SelectField` is additive only.

### Trade-offs

- The app now has two coexisting patterns for "pick one item from a list" — four bespoke local copies (Attendance/Payroll/Payment/Manager) and one shared `SelectField` (Reports). This is an accepted, temporary inconsistency rather than a defect: a future cleanup milestone that's explicitly scoped to include it could migrate the older forms onto `SelectField`, but doing that unprompted here would have meant editing four completed modules' files for a ticket that only asked for Reports.

---

## ADR-014: Self-Service Onboarding — No `User` Until Approval, Join-Code Discovery, Requested Role Is Never Authorization

**Status:** Accepted

### Decision

Three linked decisions, all part of the same feature:

1. **`STORE_MANAGER`/`EMPLOYEE` self-signup never creates a `User` before an `ORGANIZATION_ADMIN` approves it.** The new `AccessRequest` table holds the requester's email, a bcrypt hash of their password, their stated name, and their requested role as pure staging state. Approval is what creates the real `User` (and `Employee`/`Manager`) — reusing the exact transactional shape `POST /api/employees`/`POST /api/managers` already use, just sourcing credentials from the request instead of the body. The stored password hash is copied verbatim into `User.passwordHash`; it is never re-hashed and the plaintext password is never stored at any point.
2. **Organizations are discovered by an opaque join code, never a searchable directory.** `Organization.joinCode` is a unique, server-generated, cryptographically random string (Node's CSPRNG, an alphabet excluding visually-ambiguous characters), unrelated to the organization's `id` or `name`. The only public lookup (`GET /api/organizations/lookup?code=`) returns `{id, name}` for a valid, active code and an identical generic `404` for everything else — a bad code and a real-but-disabled organization's code are indistinguishable from the outside.
3. **A requester's stated role is a hint, never authorization.** `AccessRequest.requestedRole` is stored and shown to the reviewing admin, but the approval endpoint takes its own explicit `role` field (structurally limited to `EMPLOYEE`/`STORE_MANAGER` — `ORGANIZATION_ADMIN`/`SUPER_ADMIN` aren't valid values for it at all) and that is what the new `User.role` becomes. An admin can approve a request into a different role than what was requested.

### Reason

**On (1):** every existing service in this codebase performs `const organizationId = auth.organizationId!` — a non-null assertion resting on the invariant "every non-`SUPER_ADMIN` role always has an organization." The alternative design (create a `User` immediately at request time, with `organizationId: null`, pending approval) would have broken that invariant for a whole new class of account, requiring an audit and new guard in every one of those call sites — Dashboard, Reports, Attendance, Payroll, Payments, Employees, Managers, Stores. Keeping the password as staging state on `AccessRequest` instead means this entire feature is additive: not one existing service needed to change to accommodate it.

**On (2):** a directory of organization names searchable by an unauthenticated caller would let anyone enumerate which businesses use WorkPulse — real information disclosure for a B2B product where the customer list itself is sensitive. A join code shared out-of-band by the organization (analogous to a Slack workspace invite code) avoids this while still letting a legitimate requester self-identify the right organization before submitting.

**On (3):** the ticket's core security requirement — "a requester must never be able to grant themselves a privileged role" — is only actually true if the field a requester controls is never the field that determines the outcome. Storing `requestedRole` as a hint and requiring the approval endpoint's own `role` input (not merely validating that the two match) makes the admin's decision the sole source of truth for what gets written, structurally, not just by convention.

### Alternatives Considered

- Creating the `User` at signup time with `organizationId: null` and a "pending" flag — rejected; the invariant-breaking cost across the whole existing codebase (detailed above) was judged far higher than the UX cost of "no session before approval."
- A public, searchable organization directory — rejected outright as a real information-disclosure risk; not seriously considered as viable for this product.
- Trusting `AccessRequest.requestedRole` directly at approval (with the admin only able to accept or reject the request as a whole, not change the role) — rejected; it would mean a rejection is the *only* way to correct a requester's mistaken or presumptuous role choice, forcing them to resubmit, instead of the admin simply approving into the right role in one step.
- Bcrypt for the `statusToken` (matching how passwords are hashed) — rejected in favor of SHA-256, for the same reason `RefreshToken` already uses SHA-256 over bcrypt: a status check needs an exact-match lookup by value, which bcrypt's per-call salting can't support.

### Trade-offs

- A `STORE_MANAGER`/`EMPLOYEE` requester has no real session and cannot log in at all until approved — their only way to check progress is holding onto the `requestId`/`statusToken` pair returned once at submission, with no resend/recovery flow in V1. Accepted as the direct, worthwhile cost of keeping every existing service's authorization assumptions intact.
- The same email can end up with simultaneous `PENDING` requests at two different organizations (allowed by design — see `docs/database.md`). If both are approved, whichever transaction commits second hits `User.email`'s global unique constraint and rolls back cleanly (verified by test, not just reasoned about) — the losing request reverts to `PENDING` rather than landing in a half-approved state, but that admin does have to notice and handle the resulting conflict manually; there's no cross-organization coordination to prevent it from happening in the first place.
- Rejection reasons are admin-only in V1 (never shown to the requester) — a deliberate, conservative default per the ticket's own instruction, not a technical limitation; exposing them later would be a small, additive change to the status endpoint's response shape.
---

## ADR-015: Web Sessions Use an httpOnly Refresh Cookie, Additively — Mobile's JSON Contract Is Untouched

### Decision

1. The web client's refresh token is delivered and accepted as an **httpOnly, path-scoped cookie** (`workpulse_refresh_token`, `Path=/api/auth`), never in a response body and never readable by JavaScript. The access token stays in memory only (Zustand), and is the sole credential for every non-auth API call.
2. This is **opt-in per request**, not a replacement. A client asks for cookie handling by sending `X-WorkPulse-Client: web`; without that header the endpoints behave exactly as before — `refreshToken` in the JSON body, no cookie set. `/auth/refresh` and `/auth/logout` resolve their token cookie-first, body-second.
3. CSRF is defended by **Origin validation on exactly the endpoints that can be driven by an ambient browser credential** (`verifyWebOrigin` on the four `/auth` routes), plus `SameSite` on the cookie. CORS uses an exact-origin allowlist (`WEB_ORIGINS`) with `credentials: true`, never a wildcard.

### Reason

**On (1):** a browser is a materially more hostile storage environment than a native app. Mobile can put a refresh token in SecureStore (Keychain/Keystore) where no other code can read it; the browser equivalent — `localStorage` — is readable by any script that achieves XSS on the origin, turning a single injection into a persistent account takeover. An httpOnly cookie is the only storage the page's own JavaScript cannot exfiltrate, so it's the only option that doesn't weaken the existing security posture when moving to web.

**On (2):** replacing the JSON refresh contract outright would have broken the shipped mobile app, which reads `refreshToken` from the response body and stores it itself. Keying the behavior off an explicit client header means the two contracts coexist with no branching in the service layer at all — only the controller chooses a response shape. Backend tests confirm both paths, including an explicit "mobile login is unchanged" case.

**On (3):** CSRF only exists where credentials are *ambient*. Every WorkPulse route except the four `/auth` ones authenticates with a `Bearer` access token held in memory, which application code must attach deliberately — a cross-site page cannot produce one, so those routes are structurally immune and need no token plumbing. That leaves a small, well-defined surface where Origin checking is both sufficient (browsers forbid pages from forging `Origin`) and invisible to native clients, which send no `Origin` and carry no cookie. `SameSite` is a second layer rather than the only one, because a genuinely cross-site deployment may have to run `SameSite=None`.

### Alternatives Considered

- `localStorage` refresh token (zero backend work) — rejected; see (1). The convenience is not worth converting any XSS into a durable session compromise.
- Replacing the body contract with cookies for all clients — rejected; it breaks the shipped mobile app for no benefit, since a native app gains nothing from cookies and loses SecureStore.
- Double-submit CSRF tokens — rejected as redundant here. With only four cookie-authenticated endpoints, none of which return data a cross-origin page could read (CORS blocks that), Origin validation achieves the same outcome without adding a token to mint, store, rotate and verify.
- Session-cookie authentication for *all* API routes — rejected; it would widen the CSRF surface from four endpoints to the entire API, requiring exactly the token plumbing avoided above, and would abandon the stateless Bearer model the mobile app already uses.

### Trade-offs

- Cookie attributes (`Secure`, `SameSite`, `Domain`) are now deployment-topology configuration rather than constants. A same-site deployment (`app.` + `api.` on one registrable domain) runs `SameSite=Lax`; a genuinely cross-site one must set `SameSite=None` **and** `Secure=true`. Getting this wrong silently breaks session restoration, so the defaults are the conservative same-site pair and `.env.example` documents the constraint.
- The web app cannot read its own refresh token, so it cannot pre-emptively check expiry — it discovers an expired session by attempting a refresh and handling the 401. This is the intended shape (the interceptor already does exactly one refresh-and-retry), but it does mean one failed request per expiry.
- `refreshSchema`/`logoutSchema` now accept an optional `refreshToken`, since a browser sends no body. A missing token is rejected as a 401 by the controller rather than a 422 by the schema — deliberate, so an expired browser session and a malformed request are indistinguishable to a caller.

---

## ADR-016: SUPER_ADMIN Accounts Are Created Only by an Explicit, Idempotent Bootstrap Script

### Decision

There is no route, seed file, or startup hook that creates a `SUPER_ADMIN`. The only mechanism is `npm run bootstrap:super-admin`, which reads `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` from the environment, hashes the password with the same `bcrypt` cost (12) as every other account, and creates a `User` with `role: SUPER_ADMIN, organizationId: null`. It is idempotent — re-running it against an email that's already `SUPER_ADMIN` is a no-op — and it refuses to touch an existing account of any other role rather than silently promoting it.

### Reason

A platform-owner account is qualitatively different from every other account this codebase creates: it has no tenant, no approval workflow, and no legitimate self-service path — there is no product reason a `SUPER_ADMIN` should ever come from a public request. Making it a deliberate, out-of-band command (not a server-startup side effect, not a public endpoint) means the only way one gets created is someone with shell/environment access on the deployment choosing to run it — the same trust boundary that already governs `DATABASE_URL` and the JWT secret.

Idempotency matters because local setup steps get re-run — a fresh clone, a reset test database, a forgotten step re-triggered. A bootstrap that errors or duplicates on a second run is worse than useless during onboarding; matching the existing project's other idempotent-by-construction operations (join code generation, access-request approval) kept this consistent rather than inventing a new failure mode.

Refusing to reassign an existing non-`SUPER_ADMIN` account's role (rather than "helpfully" upgrading it) closes the obvious misuse: if this ever ran against a real customer's email by mistake, it fails loudly instead of turning a tenant's `ORGANIZATION_ADMIN` into a platform owner.

### Alternatives Considered

- A Prisma seed script (`prisma db seed`) — rejected; seeds conventionally populate a whole dataset and often run automatically against a fresh database, which doesn't fit "one specific privileged account, created deliberately." A dedicated script's name says exactly what it does.
- A temporary public signup endpoint, removed later — rejected outright; "temporary" security surface has a way of outliving the sprint that added it, and it's unnecessary when a script does the job with zero attack surface.
- Auto-creating a `SUPER_ADMIN` on server startup if none exists — rejected; it would run on every environment including production, need a place to put freshly-generated credentials (logs? stdout?), and turn a deliberate action into an implicit one triggered by deploy timing.

### Trade-offs

- `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` exist as environment variables purely for this script's benefit — the running server never reads them. They can be removed from `.env` immediately after running the bootstrap once; leaving them in has no ongoing effect since the operation is idempotent either way.
- There's still no way to create a *second* `SUPER_ADMIN` except running the same script again with a different email — acceptable for a platform-owner role that's expected to be rare, not something needing a management UI.

---

## ADR-017: Attendance Status Changes Are Always an `UPDATE` to the Existing Row — Direct Admin Edit and Correction Approval Share One Invariant

### Decision

1. `Attendance(employeeId, date)` has exactly one row, enforced by a database unique index — this was already true before this milestone and remains the single source of truth for the invariant, not application-level checking alone.
2. There are now exactly two ways `Attendance.status` can change after creation, and both are a plain `UPDATE` against that one row: an `ORGANIZATION_ADMIN` direct edit (`PATCH /api/attendance/:id`, new) and an approved `AttendanceCorrection` (existing, unchanged in shape). Neither path, nor any other code path in the service layer, ever calls `create` to represent a status change.
3. The direct-edit path is enforced admin-only at two independent layers: the route selects between two Zod schemas based on `req.auth.role` (STORE_MANAGER's omits `status` entirely — sending it is a `.strict()`-rejected unknown field, a 422, not a silent ignore), and the service function re-checks the role itself before writing, independent of which schema validated the request.
4. A new partial unique index, `AttendanceCorrection(attendanceId) WHERE status = 'PENDING'`, caps pending corrections at one per attendance record — the database-level form of "no conflicting duplicate correction requests."
5. A new `Attendance.statusChangedByUserId`/`statusChangedAt` pair records who most recently changed `status` and when, set by both paths above (never by creation itself), separate from `markedByUserId` (who originally recorded the row).

### Reason

A manually-discovered bug report described a duplicate `Attendance` row appearing after attempting to change an employee's status from PRESENT to ABSENT. Per the investigation requirement ("do not guess the root cause"), this was traced by inspection rather than assumed: the `(employeeId, date)` unique index and the service's `P2002`→`409 Conflict` handling were both already present in the codebase and verified live against the running database (`psql \d "Attendance"`) — a second `create` call for the same employee/date was already structurally rejected, not silently duplicated, and an existing test (`returns 409 for a duplicate employee/date attendance record`) already proved it.

The actual defect was upstream of that: no `update` path for `status` existed at all. A prior comment in `attendance.schemas.ts` documented this as deliberate ("Attendance status changes go through the separate AttendanceCorrection workflow... direct status edits after creation aren't allowed"). With no edit action and no literal path from PRESENT to ABSENT for a record someone had already marked, the only tool available to "change" a record was resubmitting the create form — the wrong tool, reaching for `create` where `update` was needed, exactly the failure mode the bug report described. This decision closes that gap by giving `ORGANIZATION_ADMIN` (who PROJECT.md already grants direct authority over attendance) a real update path, while keeping the underlying single-row invariant exactly as strict as it already was.

**On (3)'s two-layer enforcement**: this codebase's established discipline is that frontend/route gating is never the only thing standing between a role and an unauthorized mutation. The schema-selection layer alone would already stop a STORE_MANAGER request, but the service-layer check doesn't rest on that alone — matching the same "never rely on routing alone" reasoning already applied to `organization.routes.ts`'s per-role schema dispatch and to every tenant-scoping `buildScopedWhere` in this codebase.

**On (4)**: without it, two corrections could be requested for the same attendance record (by different store visits, a retry, or a race), and if both were later approved, the second approval's `UPDATE` would simply overwrite the first with no record of the conflict. A partial unique index — the same pattern already established for `AccessRequest`'s "one PENDING per (email, organization)" — makes the conflict impossible to create in the first place, at the database, not just inconvenient to resolve after the fact.

**On (5)**: `markedByUserId` answers "who recorded this attendance." It does not answer "who most recently decided what the status actually is," which is a different, newly-relevant question now that status can change twice (or more) after creation. Both mutation paths write the same pair of columns so the answer is consistent regardless of which path produced the current status.

### Alternatives Considered

- Leaving status changes exclusively in the correction workflow, with no direct-edit path at all — rejected; this is the status quo that produced the bug report's underlying confusion, and the ticket's own product requirement explicitly grants `ORGANIZATION_ADMIN` direct authority.
- A single `updateAttendanceSchema` with `status` simply made optional for everyone, relying only on the service-layer role check to reject it for `STORE_MANAGER` — rejected in favor of the two-schema dispatch; a `STORE_MANAGER` sending `status` should get an immediate, specific 422 from validation, not a 403 from business logic three layers deeper for what is, from the schema's point of view, an entirely foreseeable unauthorized field.
- Optimistic locking (a version column) on `Attendance` to guard concurrent direct edits — rejected as unnecessary scope; no other mutable record in this schema uses one, "last write wins" is the existing codebase-wide convention for conflicting updates, and the one case that actually needed race-proofing (duplicate corrections) is handled by the partial unique index instead.
- An app-level `findFirst`-then-create check for duplicate pending corrections, without a database constraint — rejected; this codebase has already established (via `AccessRequest`) that an app-level check alone has a real TOCTOU race window under concurrent requests, closed only by pushing the constraint into the database itself.

### Trade-offs

- `statusChangedByUserId`/`statusChangedAt` are nullable and stay `NULL` for the (likely large) majority of rows whose status is never changed after creation — an intentional "only pay for what you use" choice over, say, a separate audit-log table, consistent with this codebase's existing minimal-schema bias (no adjustment-ledger table for Payroll either, per ADR history).
- Two Zod schemas for one PATCH route (`updateAttendanceAsOrgAdminSchema` / `updateAttendanceAsStoreManagerSchema`) is marginally more ceremony than one shared schema — judged worth it for the "wrong field is caught at the validation boundary, not three layers in" property described above.
- A direct `ORGANIZATION_ADMIN` edit can still change status while an unrelated `AttendanceCorrection` sits `PENDING` for the same record (the partial unique index only prevents a *second pending correction*, not an admin edit alongside one) — deliberate: admin authority over attendance isn't made contingent on whatever a store manager happens to have requested, and the admin can resolve the now-stale correction (reject it) afterward. Not treated as a gap; treated as admin authority working as intended.
