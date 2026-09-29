# Mobile App

Status: foundation only (navigation, theme, auth, API client, Login screen). See `docs/decisions.md` ADR-006 for the architecture decisions behind it.

## Stack

Expo SDK 57, React Native 0.86, TypeScript (strict), React Navigation (native-stack + bottom-tabs), Zustand, TanStack Query, Axios, React Native Paper (installed, minimally used — see ADR-006), `expo-secure-store`, `@expo-google-fonts/manrope`.

Run with Node 22 LTS (`nvm use 22`), not the backend's Node 24 — Expo/Metro compatibility with brand-new Node majors lags, and there's no need for the mobile and backend toolchains to match.

## Structure

```
mobile/
  App.tsx                 — providers (React Query, Paper, SafeArea, NavigationContainer), font/auth bootstrap, splash hold
  src/
    api/                   client.ts (axios instance + 401 refresh-and-retry), auth.ts (login/refresh/logout/me)
    components/            AppText, AppButton, AppInput, AppCard, ScreenContainer, SectionHeader, StatusBadge, Avatar, IconButton, Divider, LoadingState, EmptyState
    constants/config.ts    API_BASE_URL (EXPO_PUBLIC_API_URL, else localhost/10.0.2.2 by platform)
    navigation/            AuthNavigator (Login), AppNavigator (bottom tabs), RootNavigator (switches on auth status), types.ts
    screens/               LoginScreen (real), Home/Attendance/Employees/Payroll/More (placeholders)
    stores/authStore.ts    Zustand — accessToken/user in memory, refresh token in SecureStore only
    theme/                 colors.ts, typography.ts, spacing.ts, index.ts (static `theme` export)
    types/                 auth.ts, employee.ts, store.ts, api.ts
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

## What's intentionally not here yet

Employee CRUD, attendance (QR or manual), payroll/payment screens, reports, manager workflows, offline sync, push notifications — all separate future milestones. The four non-Home tabs are `EmptyState` placeholders that exist only to prove the navigation shell works.
