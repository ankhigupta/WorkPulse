# Mobile App

Status: foundation (navigation, theme, auth, API client, Login screen), a real Home/Dashboard screen, a real Employees module (list/detail/create/edit), a real Managers module (list/detail/create/edit, `ORGANIZATION_ADMIN`-only), a real Attendance module (list + manual create), a real Attendance Corrections module (request/list/approve/reject), a real Payroll module (list/create/recalculate/finalize), and a real Payment Ledger module (list/record/balance) — Payroll and Payments both also `ORGANIZATION_ADMIN`-only. See `docs/decisions.md` ADR-006 through ADR-012 for the architecture decisions behind it.

## Stack

Expo SDK 57, React Native 0.86, TypeScript (strict), React Navigation (native-stack + bottom-tabs), Zustand, TanStack Query, Axios, React Native Paper (installed, minimally used — see ADR-006), `expo-secure-store`, `@expo-google-fonts/manrope`.

Run with Node 22 LTS (`nvm use 22`), not the backend's Node 24 — Expo/Metro compatibility with brand-new Node majors lags, and there's no need for the mobile and backend toolchains to match.

## Structure

```
mobile/
  App.tsx                 — providers (React Query, Paper, SafeArea, NavigationContainer), font/auth bootstrap, splash hold
  src/
    api/                   client.ts (axios instance + 401 refresh-and-retry), auth.ts, dashboard.ts, employees.ts, managers.ts, stores.ts, attendance.ts, attendanceCorrections.ts, payroll.ts, payments.ts
    components/            AppText, AppButton, AppInput, AppCard, ScreenContainer, SectionHeader, StatusBadge, Avatar, IconButton, Divider, LoadingState, EmptyState, MetricCard, DashboardSection, SummaryRow, EmployeeCard, EmployeeForm, ManagerCard, ManagerForm, AttendanceCard, AttendanceDateSelector, AttendanceForm, CorrectionCard, PayrollCard, PaymentCard
    constants/config.ts    API_BASE_URL (EXPO_PUBLIC_API_URL, else localhost/10.0.2.2 by platform)
    hooks/                 useDashboardSummary.ts, useEmployees.ts, useManagers.ts, useStores.ts, useAttendance.ts, useAttendanceCorrections.ts, usePayroll.ts, usePayments.ts
    navigation/            AuthNavigator (Login), AppNavigator (bottom tabs — Payroll conditionally registered, see ADR-011), EmployeesNavigator (nested stack — now also holds Manager list/detail/create/edit), AttendanceNavigator, PayrollNavigator (nested stacks — the latter now also holds Payments list/create + EmployeeBalance), RootNavigator, types.ts
    screens/               LoginScreen, HomeScreen, employees/ (List/Detail/Create/Edit), managers/ (List/Detail/Create/Edit), attendance/ (List/Create, CorrectionsList, CorrectionCreate), payroll/ (List/Create), payments/ (List/Create, EmployeeBalance), More (placeholder)
    stores/authStore.ts    Zustand — accessToken/user in memory, refresh token in SecureStore only
    theme/                 colors.ts, typography.ts, spacing.ts, index.ts (static `theme` export)
    types/                 auth.ts, employee.ts, manager.ts, store.ts, api.ts, dashboard.ts, attendance.ts, attendanceCorrection.ts, payroll.ts, payment.ts
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

## What's intentionally not here yet

QR attendance capture, reports, employee notes, QR code display, offline sync, push notifications, employee invitation/account-linking, manager password reset — all separate future milestones (or, for password reset, not supported by the backend at all yet). The More tab is still an `EmptyState` placeholder.
