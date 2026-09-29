# Mobile App

Status: foundation (navigation, theme, auth, API client, Login screen), a real Home/Dashboard screen, and a real Employees module (list/detail/create/edit). See `docs/decisions.md` ADR-006/ADR-007/ADR-008 for the architecture decisions behind it.

## Stack

Expo SDK 57, React Native 0.86, TypeScript (strict), React Navigation (native-stack + bottom-tabs), Zustand, TanStack Query, Axios, React Native Paper (installed, minimally used — see ADR-006), `expo-secure-store`, `@expo-google-fonts/manrope`.

Run with Node 22 LTS (`nvm use 22`), not the backend's Node 24 — Expo/Metro compatibility with brand-new Node majors lags, and there's no need for the mobile and backend toolchains to match.

## Structure

```
mobile/
  App.tsx                 — providers (React Query, Paper, SafeArea, NavigationContainer), font/auth bootstrap, splash hold
  src/
    api/                   client.ts (axios instance + 401 refresh-and-retry), auth.ts, dashboard.ts, employees.ts, stores.ts
    components/            AppText, AppButton, AppInput, AppCard, ScreenContainer, SectionHeader, StatusBadge, Avatar, IconButton, Divider, LoadingState, EmptyState, MetricCard, DashboardSection, SummaryRow, EmployeeCard, EmployeeForm
    constants/config.ts    API_BASE_URL (EXPO_PUBLIC_API_URL, else localhost/10.0.2.2 by platform)
    hooks/                 useDashboardSummary.ts, useEmployees.ts (list/detail/create/update), useStores.ts
    navigation/            AuthNavigator (Login), AppNavigator (bottom tabs), EmployeesNavigator (nested stack: list/detail/create/edit), RootNavigator, types.ts
    screens/               LoginScreen, HomeScreen (real dashboard), employees/ (List/Detail/Create/Edit, all real), Attendance/Payroll/More (placeholders)
    stores/authStore.ts    Zustand — accessToken/user in memory, refresh token in SecureStore only
    theme/                 colors.ts, typography.ts, spacing.ts, index.ts (static `theme` export)
    types/                 auth.ts, employee.ts, store.ts, api.ts, dashboard.ts
    utils/                 format.ts (currency/date display, UTC-safe), validation.ts (email pattern, date-only shape check)
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

## What's intentionally not here yet

Attendance (QR or manual), payroll/payment screens, reports, manager management, employee notes, QR display, offline sync, push notifications, employee invitation/account-linking — all separate future milestones. Attendance/Payroll/More tabs are still `EmptyState` placeholders.
