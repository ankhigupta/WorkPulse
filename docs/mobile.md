# Mobile App

Status: foundation (navigation, theme, auth, API client, Login screen), a real Home/Dashboard screen, a real Employees module (list/detail/create/edit), a real Managers module (list/detail/create/edit, `ORGANIZATION_ADMIN`-only), a real Attendance module (list + manual create), a real Attendance Corrections module (request/list/approve/reject), a real Payroll module (list/create/recalculate/finalize), a real Payment Ledger module (list/record/balance), a real Reports module (Attendance/Payroll/Payments/Workforce, filterable, both roles), and a real, role-aware More/Admin area (Account, Organization, Stores) — Payroll and Payments both `ORGANIZATION_ADMIN`-only. See `docs/decisions.md` ADR-006 through ADR-013 for the architecture decisions behind it.

## Stack

Expo SDK 57, React Native 0.86, TypeScript (strict), React Navigation (native-stack + bottom-tabs), Zustand, TanStack Query, Axios, React Native Paper (installed, minimally used — see ADR-006), `expo-secure-store`, `@expo-google-fonts/manrope`.

Run with Node 22 LTS (`nvm use 22`), not the backend's Node 24 — Expo/Metro compatibility with brand-new Node majors lags, and there's no need for the mobile and backend toolchains to match.

## Structure

```
mobile/
  App.tsx                 — providers (React Query, Paper, SafeArea, NavigationContainer), font/auth bootstrap, splash hold
  src/
    api/                   client.ts (axios instance + 401 refresh-and-retry), auth.ts, dashboard.ts, employees.ts, managers.ts, stores.ts (now also create/update), organization.ts (new), attendance.ts, attendanceCorrections.ts, payroll.ts, payments.ts, reports.ts
    components/            AppText, AppButton, AppInput, AppCard, ScreenContainer, SectionHeader, StatusBadge, Avatar, IconButton, Divider, LoadingState, EmptyState, MetricCard, DashboardSection, SummaryRow, EmployeeCard, EmployeeForm, ManagerCard, ManagerForm, AttendanceCard, AttendanceDateSelector, AttendanceForm, CorrectionCard, PayrollCard, PaymentCard, SelectField, DateRangeFilter, StoreCard, StoreForm
    constants/config.ts    API_BASE_URL (EXPO_PUBLIC_API_URL, else localhost/10.0.2.2 by platform)
    hooks/                 useDashboardSummary.ts, useEmployees.ts, useManagers.ts, useStores.ts (now also create/update), useOrganization.ts (new), useAttendance.ts, useAttendanceCorrections.ts, usePayroll.ts, usePayments.ts, useReports.ts
    navigation/            AuthNavigator (Login), AppNavigator (bottom tabs — Payroll conditionally registered, see ADR-011), EmployeesNavigator (nested stack — now also holds Manager list/detail/create/edit), AttendanceNavigator, PayrollNavigator (nested stacks — the latter now also holds Payments list/create + EmployeeBalance), MoreNavigator (Reports + Account + Organization + Stores, all role-aware), RootNavigator, types.ts
    screens/               LoginScreen, HomeScreen, employees/ (List/Detail/Create/Edit), managers/ (List/Detail/Create/Edit), attendance/ (List/Create, CorrectionsList, CorrectionCreate), payroll/ (List/Create), payments/ (List/Create, EmployeeBalance), more/ (MoreHome, Account, Organization), reports/ (Attendance/Payroll/Payments/Workforce), stores/ (List/Create/Edit)
    stores/authStore.ts    Zustand — accessToken/user in memory, refresh token in SecureStore only
    theme/                 colors.ts, typography.ts, spacing.ts, index.ts (static `theme` export)
    types/                 auth.ts, employee.ts, manager.ts, store.ts (now also Create/UpdateStoreInput), organization.ts (new), api.ts, dashboard.ts, attendance.ts, attendanceCorrection.ts, payroll.ts, payment.ts, report.ts
    utils/                 format.ts (currency/date/datetime display, UTC-safe), validation.ts (email pattern, date-only shape check, money-amount shape check), date.ts (calendar-date arithmetic, UTC-safe, incl. month bounds)
```

## Theme

Values are transcribed from `docs/design/Final — Charcoal + Burnished Copper — Design System@1x.png` — treat that image as the source of truth for any token change, not this file. Colors, typography (Manrope, 4 weights loaded), spacing (4/8/12/16/24/32), and radii (8/12/16/pill) all live in `src/theme/`. No light/dark toggle — WorkPulse V1 has one brand.

## Authentication

Backed by the existing `POST /api/auth/{login,refresh,logout}` + `GET /api/auth/me` — no new backend endpoints, no invitation/password-reset flow (out of scope, per the milestone ticket).

- Access token and hydrated user live only in the Zustand store (memory) — lost on app restart by design.
- The refresh token is the only thing persisted, and only in `expo-secure-store` (Keychain/Keystore-backed), never AsyncStorage or a `persist` middleware.
- On cold start, `App.tsx` calls `authStore.bootstrap()`: reads the stored refresh token, exchanges it for an access token, fetches `/auth/me`, and only then releases the splash screen. No refresh token → straight to the Login screen.
- The axios response interceptor catches a single 401, retries once through `authStore.refresh()`, and force-logs-out if that also fails — this is foundation plumbing every future authenticated screen depends on, not scope creep.

## Employee ≠ User, reflected in the client

`src/types/employee.ts`'s `Employee.user` is `T | null`, matching the backend exactly (see `docs/database.md`'s "Employee ≠ User"). `Employee.name` is the only field used for display; nothing in the mobile codebase reads `user.email` as an identity. No employee-management screens exist yet, but the type is intentionally correct ahead of that milestone.

## Dashboard (Home screen)

Backed by the existing `GET /api/dashboard/summary` — no new backend endpoint, no backend changes at all. Server state lives in TanStack Query (`useDashboardSummary`, key `["dashboard", "summary"]`), never in Zustand — Zustand is auth-session state only. Pull-to-refresh calls `refetch()` on the same query; it does not maintain a parallel copy of the data.

No date params are sent yet — the screen relies entirely on the backend's own current-calendar-month default. Adding a date range picker is deferred (see ADR-007) rather than assumed.

**Everything shown is a real field from the API response — nothing is invented.** Two deliberate departures from the design reference, both because the underlying data doesn't exist:
- Attendance only shows Present/Absent (+ rate) — the backend models exactly those two statuses, not the four (On time/Late/Absent/Leave) the design mockup shows.
- The store-filter chip row, the notification bell, the "Needs attention" correction list, and the "Processing" payroll status badge are all absent from the screen — `dashboard.schemas.ts` accepts no `storeId` filter, the summary response has no per-correction list or notification data, and `Payroll.status` is only ever `DRAFT`/`FINALIZED`, never "Processing." None of these are derivable from `GET /api/dashboard/summary`, so they're omitted rather than faked.

The greeting reads "Good morning, {organization.name}" rather than a person's name — `User` (the login identity) has no name field, only `email` (see ADR-005); inventing a display name would misrepresent real data.

## Employees module

Backed entirely by the existing `GET/POST /api/employees`, `GET/PATCH /api/employees/:id`, and `GET /api/stores` (for the store picker) — no backend changes. Server state lives in TanStack Query (`useEmployeeList`, `useEmployee`, `useCreateEmployee`, `useUpdateEmployee`, all in `hooks/useEmployees.ts`); Zustand is untouched by any of it. Query key scheme: `["employees"]` for the list, `["employees", id]` for a detail — both create and update invalidate the plain `["employees"]` key, which TanStack Query's default prefix-matching also invalidates every cached detail under.

The `EmployeeDetailScreen` seeds its query's `initialData` from the already-loaded list (same shape, both go through the backend's identical `employeeSelect`), so tapping a row shows real data instantly while the detail endpoint still revalidates in the background — not a second blind fetch, not stale-forever cached data either.

**Role-gated by the backend's actual permissions, not a separate mobile rule:** `POST /employees` and `PATCH /employees/:id` are `ORGANIZATION_ADMIN`-only on the backend (`STORE_MANAGER` is read-only for employees) and `GET /stores` is `ORGANIZATION_ADMIN`-only entirely. The mobile UI mirrors this by simply not rendering the Create/Edit entry points for `STORE_MANAGER` — the backend remains the actual enforcement point if that were ever bypassed.

Several elements in the Mobile Employees design reference aren't real backend fields and are omitted rather than faked — see ADR-008: the `EMP-XXXX` code and job title, the per-employee "days present this month" progress line, and the "On leave" filter chip.

`joinedAt` from the API is a full ISO datetime (`2026-01-15T00:00:00.000Z`), not a plain date — `Employee.joinedAt` is a raw Prisma `DateTime` column, never reformatted server-side the way Dashboard's `period` dates are. `utils/format.ts`'s `toDateOnlyString()` slices it to `YYYY-MM-DD` before it ever reaches a form field, so editing an employee doesn't leak a raw timestamp into the joined-date input.

## Managers module

Backed entirely by `GET/POST /api/managers` and `GET/PATCH /api/managers/:id` — no backend changes. `ORGANIZATION_ADMIN`-only end to end, same reasoning as Payroll/Payments (`manager.routes.ts` gates its whole router to that role) — so, unlike Employees, `EmployeeListScreen`'s "View managers" entry point (and the whole `ManagerList`/`ManagerDetail`/`ManagerCreate`/`ManagerEdit` screen set) only renders when `isAdmin` is true; `STORE_MANAGER` never sees it.

**Manager has no `name` field at all — confirmed directly against `prisma/schema.prisma`, not assumed.** Unlike `Employee` (which gained a dedicated `name` field in ADR-005 specifically because an `Employee` can exist without a `User`), `Manager.userId` is required, not nullable — every manager has exactly one `User`, always. Because the two are genuinely 1:1 and mandatory here, showing `manager.user.email` as the manager's display identity isn't the same "Employee ≠ User" conflation ADR-005 warned against — for `Manager` specifically, the login email *is* the only real identity there is, so `ManagerCard`/`ManagerDetailScreen` show it plainly rather than inventing a name field that doesn't exist.

**Create requires email + password together, always — never optional the way Employee's are.** `createManagerSchema` has no email/password-optional path at all (both fields are always required, unlike `createEmployeeSchema`'s "both or neither" refine), so `ManagerForm`'s create mode doesn't need — and doesn't have — that together-or-neither validation; it just requires both, matching the schema exactly.

**No credential-change path exists, so the mobile app doesn't invent one.** `updateManagerSchema` accepts only `storeId`/`joinedAt`/`isActive` — no email, no password. `ManagerForm`'s edit mode has no email/password fields at all, and there is no "reset password" action anywhere in the Manager screens.

Reuses the existing `EmployeesStackParamList`/`EmployeesNavigator` rather than a new tab or navigator — the same "sibling module, header-button entry point" pattern Corrections and Payments established, chosen because the milestone ticket itself frames Managers as an organization-admin-managed workforce record consistent with Employees, and `EmployeeListScreen` was already the natural, already-admin-checked place to add the entry point from.

## Attendance module

Backed entirely by `GET /api/attendance` and `POST /api/attendance` — no backend changes. Server state lives in TanStack Query, key `["attendance", { date, ... }]` (`hooks/useAttendance.ts`'s `attendanceKey(params)`), so a different selected date is a genuinely different cached query rather than one shared key being overwritten — switching dates shows that date's own loading/cached state correctly. Create invalidates the whole `["attendance"]` prefix, covering every cached date at once.

`Attendance` has no nested employee/store name (`attendanceSelect` on the backend returns only `employeeId`/`storeId`) — names are resolved client-side from the already-loaded `useEmployeeList()`/`useStoreList()` caches (a `Map` built with `useMemo`), not a second per-record fetch. This is the same N+1-avoidance pattern the Employees module already established, applied here because the backend response shape requires it.

`Attendance.date` and `Employee.joinedAt` have the same "full ISO string, not a plain date" quirk (see ADR-005/prior note) — confirmed directly against a backend test assertion (`res.body.date === "2026-01-15T00:00:00.000Z"`), not assumed. `AttendanceCard` and the date selector both go through `toDateOnlyString`/`formatDateOnly`.

**No attendance record is never rendered as Absent.** The list's `ListEmptyComponent` explicitly says no one has been marked present *or* absent yet — `ABSENT` only ever appears for a real `Attendance` row with that status, never as a fallback interpretation of a missing one.

Status is fixed to `PRESENT`/`ABSENT` (`AttendanceStatus` type has no other members) with `StatusBadge` tones `success`/`error` — the `error` tone for absent is a direct reuse of the design system's own "Error / absent" palette entry, not an improvised choice. See ADR-009 for the scope cuts made against the create form specifically (method, checkInAt, QR).

## Attendance Corrections module

Backed by `POST/GET /api/attendance-corrections` and `POST /api/attendance-corrections/:id/{approve,reject}` — no backend changes. The workflow is never bypassed: attendance status changes only ever happen as a side effect of an `ORGANIZATION_ADMIN` approving a correction (server-side, inside the backend's own transaction) — nothing in the mobile app calls `PATCH /api/attendance/:id` for a status change, because that endpoint doesn't even accept `status`.

**Entry point is the Attendance list itself, not a standalone "pick an employee and date" form.** Tapping an `AttendanceCard` on `AttendanceListScreen` navigates straight to `CorrectionCreateScreen` with that record's `attendanceId`/employee name/date/current status already in hand — zero extra requests, and it's structurally impossible to request a correction for a non-existent attendance record since you can only ever start from a real one. The create form itself only asks for a reason: with exactly two possible statuses, once the current one is known there's exactly one valid "requested" value, so it's shown as a fact (current → requested, via two `StatusBadge`s) instead of a redundant picker.

**Resolving employee name / attendance date / current status for the corrections list requires a bounded join — see ADR-010.** `AttendanceCorrection` only carries `attendanceId` (no employeeId, no date, no original status), so `CorrectionsListScreen` fetches `GET /api/attendance-corrections` and `GET /api/attendance` over the *same* trailing 90-day window and joins them client-side via a `Map`. This is two bulk requests for the whole screen, never one per correction — but a correction referencing attendance older than 90 days won't resolve to a name (falls back to "Attendance record"). Accepted trade-off, not a bug; see the ADR for why.

Approving invalidates both `["attendanceCorrections"]` and `["attendance"]` (approval is the one action that changes `Attendance.status`); rejecting invalidates only `["attendanceCorrections"]`. Each `CorrectionCard` owns its own approve/reject mutations, so one card's in-flight action never disables another's, and a 409 ("already processed" — the backend's own concurrency guard) refetches the list instead of pretending the tap succeeded.

## Payroll module

Backed by `GET/POST /api/payroll` and `POST /api/payroll/:id/{recalculate,finalize}` — no backend changes. `ORGANIZATION_ADMIN`-only end to end: unlike Attendance/Employees (`STORE_MANAGER` gets read or partial access), the entire `/api/payroll` router is gated to `ORGANIZATION_ADMIN` on the backend, so the mobile app doesn't render the Payroll *tab at all* for any other role — see ADR-011, the first time this app removes a tab outright rather than hiding actions within one.

**The client never calculates `totalWage`.** `totalDaysPresent`/`totalWage` only ever come from a server response (create/recalculate both return the freshly-calculated record); nothing in `PayrollCard`, the create form, or `hooks/usePayroll.ts` counts attendance or does wage arithmetic. `totalWage` stays a string end-to-end (`formatCurrency` from the Attendance/Employees milestones, reused as-is) — it's formatted for display, never parsed into a number for anything that feeds back into a calculation.

**FINALIZED is enforced as immutable in the UI, matching the backend.** `PayrollCard` only renders Recalculate/Finalize for `status === "DRAFT"` — a `FINALIZED` record shows its `finalizedAt` timestamp and nothing else actionable. Finalize requires a native confirm dialog stating the record becomes locked; Recalculate doesn't (it's safely re-runnable, unlike finalize's one-way transition). Both mutations invalidate `["payroll"]` on error too, so a 409 (another action already finalized/processed the record — the backend's own conditional-update race guard) refetches the real state instead of leaving a stale enabled button.

**Period presets ("This month"/"Last month") are a create-form convenience, not new business logic** — they just populate the same two plain `YYYY-MM-DD` text fields (`utils/date.ts`'s new `startOfMonth`/`endOfMonth`/`addMonths`, all UTC-safe) that a user could type by hand; the backend's `periodStart <= periodEnd` rule is mirrored client-side for a fast validation error, but the backend remains the real enforcement point.

## Payment Ledger module

Backed by `GET/POST /api/payments` and `GET /api/payments/balance/:employeeId` — no backend changes. `ORGANIZATION_ADMIN`-only, same as Payroll, reached from `PayrollListScreen` via a header button rather than its own bottom tab (the same "sibling module, header-button entry point" pattern Attendance Corrections established — see docs above and ADR-010).

**Append-only, with nothing in the UI that suggests otherwise.** There is no Edit/Delete/Reverse action anywhere near a `PaymentCard`, matching the backend exactly — `payment.routes.ts` has no PATCH/PUT/DELETE route at all, not even one gated away by role.

**The client never computes a balance.** `totalOwed`/`totalPaid`/`outstanding` are displayed exactly as `GET /payments/balance/:employeeId` returns them (all three pre-stringified by the backend) — nothing in `EmployeeBalanceScreen` sums payments or payroll locally. `outstanding` is explicitly labeled "(all time)" in the UI so it's never mistaken for a period-scoped figure, matching `docs/api.md`'s own note that Dashboard's equivalent figure "is always all-time, never period-filtered."

**Overpayment is a real, expected error path, not an edge case to route around.** `POST /api/payments` rejects (409) a payment that would exceed the employee's outstanding balance, with a message that already states the attempted amount and the real limit (`payment.service.ts`'s `ConflictError`). The mobile form just surfaces that message verbatim via the same `submitError` pattern every other create form in this app uses — it never tries to pre-validate against a locally-fetched balance, compute a "safe" reduced amount, or retry.

**`paidAt` is normalized to noon UTC on the selected calendar date — see ADR-012.** The create form only asks for a date ("Paid on"), not a time; rather than branching between "now" (today) and "local midnight" (a backdated date) — two different, error-prone rules — every submission uses the same one: noon UTC on whatever date was entered. That's far enough from any timezone's day boundary to guarantee the calendar date the backend stores always matches the one shown in the form.

`amount` is the one financial field the backend requires as a plain JSON number (`z.number()`, not a coerced string) — the create form still treats it as text throughout (validated by `utils/validation.ts`'s new `isValidMoneyAmount`, mirroring the backend's exact positive/≤2-decimals/≤99999999.99 constraint) and converts it to a number exactly once, at submission, never for any local arithmetic.

## Reports module

Backed by `GET /api/reports/{attendance,payroll,payments,workforce}` — no backend changes. Available to **both** `ORGANIZATION_ADMIN` and `STORE_MANAGER` (`reports.routes.ts` allows both), unlike Payroll/Payments/Managers — so the `More` tab itself needs no role gate; only each report's *store filter* is conditionally hidden for `STORE_MANAGER` (their store is auto-scoped server-side regardless, same pattern as every other store-filterable screen in this app).

Lives inside a new `MoreNavigator` — the first real content behind the `More` tab, which was a bare placeholder before this milestone. `MoreHomeScreen` shows the four reports as real entry-point cards, not a generic "coming soon."

**The Attendance report is a different shape from the Attendance module's own record list — this is a backend fact, not a mobile simplification.** `GET /api/reports/attendance` returns *per-employee aggregates* (`prisma.attendance.groupBy` present/absent counts over the period), not individual attendance rows — there is no `method`, no per-record date, no check-in time anywhere in this response. The report screen shows exactly what's there: employee, present/absent/total, attendance rate — confirmed by reading `reports.service.ts` directly, not assumed from the Attendance module's shape.

**No client-side report math anywhere.** Payroll/Payments report totals (`draftTotal`, `finalizedTotal`, `totalPaid`, and every per-row `totalWage`/`amount`) are the backend's own pre-formatted `.toFixed(2)` strings, passed straight to the existing `formatCurrency` — nothing in `useReports.ts` or any report screen sums, multiplies, or recalculates a figure the backend already computed.

**Two different filter-commit behaviors, deliberately.** The three date-based reports (Attendance/Payroll/Payments) require an explicit "Apply" tap before a new date range triggers a request — free-text `YYYY-MM-DD` fields are invalid mid-keystroke, so auto-fetching on every character would be wasted/broken requests. Discrete filters (employee/store pickers, the payroll status chips, the workforce active-only switch) refetch immediately on change instead — they're always a complete, valid selection the instant they change, so there's nothing to wait for. Every report screen still opens pre-filled with a sensible default range (start of the current calendar month → today, reusing `utils/date.ts`'s existing `startOfMonth`/`todayDateOnly`) and fetches that immediately, so no report is ever empty-by-default while waiting for a first Apply tap.

**`GET /api/reports/payments` has no `storeId` filter at all** (confirmed against `paymentsReportQuerySchema`) — `PaymentsReportScreen` never shows a store picker, for either role, unlike the other three reports. Per-row `storeName` is still shown where the response actually returns it (it does, via the employee relation) — the *filter* doesn't exist; the *field* does.

**`activeOnly` is sent as the string `"true"`/`"false"`, never a real boolean, and only when explicitly set.** `workforceReportQuerySchema` parses an HTTP query string, not a JSON boolean — `api/reports.ts` converts right before the request rather than changing the type client-side, and omits the key entirely when unset so the backend's own default (`true`) applies instead of the client guessing at it.

No export/download of any kind was implemented — `reports.routes.ts` has no such endpoint, and none was invented.

See ADR-013 for why this milestone's employee/store pickers (`SelectField`) are a genuinely shared component, unlike every prior milestone's local per-form picker copies.

## More / Admin area

`MoreHomeScreen` is a role-aware menu, not a static placeholder — every section is derived directly from `useAuthStore`'s `user.role`, mirroring the exact role-gating pattern already used for the Payroll tab (ADR-011) and Reports' store filters, just applied at the section level within one screen instead of a whole tab/route:

- **Reports** (Attendance/Payroll/Payments/Workforce) — shown for `ORGANIZATION_ADMIN` and `STORE_MANAGER` only, matching `reports.routes.ts`'s `requireRole`. Previously shown unconditionally; this milestone added the missing gate so `EMPLOYEE`/`SUPER_ADMIN` (who would 403 on every report) never see the entry points at all.
- **Administration** (Organization, Stores) — `ORGANIZATION_ADMIN` only, matching `organization.routes.ts`/`store.routes.ts`.
- **Account** — every role, always.

`MoreNavigator` registers every screen unconditionally (same pattern `EmployeesNavigator` already uses for Manager screens) — the menu entries are gated, not the routes themselves.

### Organization

Backed by `GET/PATCH /api/organizations/:id` — **a real, previously-unused backend capability**, discovered by inspecting `organization.routes.ts` directly for this milestone rather than assumed. An `ORGANIZATION_ADMIN` may look up and rename *only their own* organization (`organization.service.ts` 404s any other id, not 403 — IDOR hygiene, not a bug to work around). `isActive` is shown read-only: it's a `SUPER_ADMIN`-only concern (platform suspend/reactivate) that `updateOrganizationAsOrgAdminSchema` doesn't accept from this role, so the mobile form never offers to change it. No organization creation, listing, or `SUPER_ADMIN` console of any kind — `POST/GET /api/organizations` (create/list-all) are `SUPER_ADMIN`-only and outside this app's defined scope, per the milestone ticket.

### Stores

Backed by the **existing** `GET/POST/PATCH /api/stores` — `api/stores.ts`/`hooks/useStores.ts` were *extended* with `createStore`/`updateStore` (and matching mutation hooks), not duplicated into a second module; `listStores`/`useStoreList` are the exact same functions every store-picker in the app already called. This is the first screen set that lets an admin actually manage stores (every prior use was read-only, as a picker inside other forms) — `StoreEditScreen` reuses the already-cached store list to pre-fill its form rather than adding a second per-store fetch. No delete anywhere; `isActive` is the only lifecycle control, matching the backend (there is no DELETE route on `/api/stores` at all).

### Account

Shows only what `GET /api/auth/me` actually returns — `email`, `role`, and (enrichment, `ORGANIZATION_ADMIN` only) the organization's real `name` via the same `useOrganization` hook the Organization screen uses. No display name, phone, avatar, or job title — `User` has none of these fields, and none were invented. Includes the Sign Out action.

### Logout — unchanged, already correct

Logout required no changes at all: `authStore.logout()` (built during the foundation milestone) already clears the SecureStore refresh token and Zustand state synchronously before the best-effort `POST /api/auth/logout` call, so a failed/unreachable server request never leaves the device locally authenticated. `RootNavigator` swaps `AppNavigator` for `AuthNavigator` entirely on `status` change (not a screen pushed on top) — the whole authenticated navigator tree, including every nested stack's history, is unmounted, so there is no back-navigation path into any authenticated screen after logout. `AccountScreen`'s Sign Out button is simply a second entry point to this same, already-correct action — `HomeScreen`'s own Sign Out button is untouched.

## What's intentionally not here yet

QR attendance capture, employee notes, QR code display, offline sync, push notifications, employee invitation/account-linking, manager password reset, report export, a `SUPER_ADMIN` organization console — all separate future milestones (or, for password reset/export/`SUPER_ADMIN` console, not supported by the backend or in this product's defined mobile scope at all).
