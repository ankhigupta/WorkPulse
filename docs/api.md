# API Reference

This file is being filled in incrementally, module by module, rather than all at once — each milestone documents only what it built, to avoid blocking implementation on retroactively writing up every prior module. It currently documents the Employees (partial — the optional-login-account behavior only), Attendance (partial — the direct status-edit behavior only), Dashboard, Reports, and Onboarding/Access Request endpoints.

## Onboarding & Access Requests

See `docs/database.md`'s "Self-Service Onboarding" section for the reasoning behind this design; this section is the endpoint reference.

### `POST /api/auth/signup/organization`

Public. Body: `{organizationName, email, password}` (`password` min 8 chars, same as every other password field in this API). Creates a new `Organization` + its first `ORGANIZATION_ADMIN` `User` atomically, and returns the exact same shape as `POST /api/auth/login` (`{accessToken, refreshToken, user}`) — the new admin is immediately logged in, no separate login step. No `SUPER_ADMIN` approval of any kind. Duplicate email → `409`, same message as every other "email already exists" case in this API. Rate-limited like login (`publicOnboardingRateLimiter`, skipped in test env).

### `GET /api/organizations/lookup?code=...`

Public. Returns `{id, name}` only, for a valid, active organization's join code. An invalid code and a real-but-inactive organization's code both produce the identical generic `404` — this endpoint can never confirm a code exists but is merely disabled. Not a directory: there is no way to search or list organizations without a code.

### `POST /api/access-requests`

Public. Body: `{organizationCode, email, password, name, requestedRole}` (`requestedRole`: `EMPLOYEE` or `STORE_MANAGER` only — the schema has no other valid value here). Resolves `organizationCode` via the same lookup as above (identical 404 for invalid/inactive). Creates a `PENDING` `AccessRequest` — **no `User` is created**. Returns `{requestId, statusToken}` once; the `statusToken` is never persisted or logged anywhere raw (only its SHA-256 hash is stored), so losing it means losing the ability to check status — there is no recovery/resend flow in V1. `409` if a `PENDING` request already exists for that exact `(email, organizationCode's organization)` pair (enforced by a database partial unique index, not just an application check — safe under real concurrent duplicate submissions). The same email may have simultaneous `PENDING` requests at *different* organizations.

### `GET /api/access-requests/:requestId/status?token=...`

Public. Requires both the path `requestId` and the query `token` (the raw `statusToken` from creation) — a wrong token or a wrong id produce the identical `404`, so this can't be used to enumerate valid request ids, and there is deliberately no way to look up a request by email alone. Returns `{status, organizationName}` only — never `email`, `requestedRole`, `requestedName`, or (a deliberate V1 default) the `rejectionReason`, which is admin-only context.

### `GET /api/access-requests`

`ORGANIZATION_ADMIN` only, scoped to the caller's own organization (mirrors every other org-scoped list in this API). Optional `?status=PENDING|APPROVED|REJECTED` filter. Never returns `passwordHash` or `statusTokenHash` — both are excluded by an explicit `select`, not fetched-then-stripped.

### `POST /api/access-requests/:requestId/approve`

`ORGANIZATION_ADMIN` only. A single atomic operation. Body is a discriminated union on `role`:
- `{role: "EMPLOYEE", storeId, joinedAt, dailyWage, name?}` — `dailyWage` is required; `name` is optional and overrides the requester's own `requestedName` when supplied.
- `{role: "STORE_MANAGER", storeId, joinedAt}` — no wage field accepted at all; supplying one is a `422` (`.strict()` schema), not a silently-ignored extra key.

`role` here — not the stored `requestedRole` — is what the new `User.role` actually becomes; the admin's choice is authoritative, and `ORGANIZATION_ADMIN`/`SUPER_ADMIN` are not valid values for this field at all (a request for either is a `422` before any service code runs). `storeId` must belong to the admin's own organization (`404` otherwise, same "wrong tenant looks not-found" convention as every other store reference in this API). On success: creates `User` (role as specified, `passwordHash` copied verbatim from the request, never re-hashed) + `Employee`/`Manager`, links `AccessRequest.createdUserId` to the new `User`, marks the request `APPROVED`. A request that's already been approved or rejected → `409` (race-safe under real concurrent double-approval, and under an approve racing a reject — exactly one ever wins, matching `AttendanceCorrection`'s established concurrency pattern). Cross-organization request id → `404`.

### `POST /api/access-requests/:requestId/reject`

`ORGANIZATION_ADMIN` only. Body: `{reason?}` (optional, admin-only — never returned by the status endpoint above). Marks the request `REJECTED`; creates nothing. Final for that request record, but not final for the person — they may submit a new request at any time afterward (no cooldown in V1). Same `409`/`404`/concurrency behavior as approve.

## Employees — optional login accounts

`POST /api/employees` (`ORGANIZATION_ADMIN` only) requires `name`, `storeId`, `dailyWage`, `joinedAt`. `email`/`password` are **optional** and must be supplied together or not at all — see `docs/database.md`'s "Employee ≠ User" section for why. When omitted, the created `Employee` has `user: null` in every response and no `User` row is ever created for it. That employee still works normally everywhere else: `POST /api/attendance` (recorded by their `STORE_MANAGER`), `POST /api/payroll`, `POST /api/payments`, and every report all operate purely on `employeeId` — none of them touch or require `Employee.user`.

## Attendance — direct status edit

See `docs/database.md`'s "Attendance status: who can change it, and how" section for the full reasoning (ADR-017).

### `PATCH /api/attendance/:attendanceId`

The body schema depends on the caller's role, selected server-side from `req.auth.role` — never trusted from the client:

- **`ORGANIZATION_ADMIN`**: `{ method?: "QR"|"MANUAL", status?: "PRESENT"|"ABSENT" }`, at least one field. `status` updates the existing row directly — no `AttendanceCorrection` is created, and no second `Attendance` row is ever created for this employee/date (the `(employeeId, date)` unique index guarantees that regardless). Sets `statusChangedByUserId`/`statusChangedAt` to the caller/now; `markedByUserId` (who originally recorded it) is untouched.
- **`STORE_MANAGER`**: `{ method: "QR"|"MANUAL" }` only — `.strict()` means sending `status` here is a `422` (unrecognized field), not a silent ignore. Status changes for this role go through `POST /api/attendance-corrections` instead.

Same tenant/store scoping as every other attendance endpoint: a record outside the caller's organization (or, for `STORE_MANAGER`, outside their assigned store) is `404`.

## Dashboard

### `GET /api/dashboard/summary`

Read-only aggregation endpoint. Returns a single summary payload scoped to the authenticated user's organization (or store, for `STORE_MANAGER`).

**Allowed roles:** `ORGANIZATION_ADMIN`, `STORE_MANAGER`. `EMPLOYEE` and `SUPER_ADMIN` get `403`.

**Query parameters** (both optional; supply both or neither):

| Param | Format | Default |
|---|---|---|
| `startDate` | `YYYY-MM-DD` | first day of the current calendar month |
| `endDate` | `YYYY-MM-DD` | last day of the current calendar month |

Supplying only one of the two is treated as supplying neither — the endpoint falls back to the full default period rather than guessing an open-ended range.

**Scope behavior:**
- `ORGANIZATION_ADMIN` sees data for their entire organization.
- `STORE_MANAGER` sees data scoped to their currently assigned store only (resolved server-side from their `Manager` record — a client-supplied `storeId` has no effect and isn't accepted as a field at all). A `STORE_MANAGER` account with no `Manager` record gets `403`.

**Response:**
```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "organization": { "id": "...", "name": "..." },
  "stores": { "total": 0, "active": 0 },
  "employees": { "total": 0, "active": 0 },
  "managers": { "total": 0, "active": 0 },
  "attendance": { "present": 0, "absent": 0, "total": 0, "attendanceRate": 0 },
  "payroll": { "finalizedTotal": "0", "draftTotal": "0" },
  "payments": { "totalPaid": "0", "totalOutstanding": "0" }
}
```
No `{success, data}` envelope — matches every other endpoint in this API, which return their payload directly.

**Period vs. all-time figures — read this carefully, the two sections don't use the same window:**
- `stores`, `employees`, `managers` — current point-in-time counts (`isActive` lifecycle respected), not period-filtered.
- `attendance`, `payroll.finalizedTotal`, `payroll.draftTotal`, `payments.totalPaid` — filtered to the selected `startDate`–`endDate` window. `attendance`/`payroll` use their own stored `storeId` (a snapshot taken when the record was created, independent of an employee's *current* store — see `docs/database.md`); `payments.totalPaid` is filtered by `paidAt`.
- `payments.totalOutstanding` — **always all-time, never period-filtered.** Reuses the exact balance rule established for the Payment Ledger (`SUM(FINALIZED Payroll.totalWage) − SUM(PaymentLedger.amount)`, both sums unbounded by date) — an unpaid payroll from months ago must still count as owed today regardless of which window the dashboard happens to be showing. Only `FINALIZED` payroll ever counts toward this; `DRAFT` payroll is provisional and is excluded.

`attendanceRate` is `present / total × 100`, rounded to 2 decimals; `0` (never `NaN`/`Infinity`) when `total` is `0`. Monetary fields are Decimal-safe strings, not floating-point numbers.

## Reports

Four read-only report endpoints, all under `/api/reports/*`. Same role/scope model as Dashboard: `ORGANIZATION_ADMIN`, `STORE_MANAGER` (own store only, resolved server-side, never client-supplied). `EMPLOYEE`/`SUPER_ADMIN` get `403`. No `{success, data}` envelope, matching every other endpoint.

**A schema note that applies to all four:** every `employeeName` field below is the real `Employee.name` field — independent of whether that employee has a login account at all. (This replaces an earlier, temporary version of these reports that used `User.email` as a placeholder before `Employee.name` existed.)

### `GET /api/reports/attendance`

**Required:** `startDate`, `endDate` (`YYYY-MM-DD`, `startDate <= endDate`). **Optional:** `employeeId`, `storeId` (ignored for `STORE_MANAGER` — their own store always wins).

Uses `Attendance.status` directly — approved corrections already update it, so this report never independently interprets `AttendanceCorrection` records. Filtered by `Attendance`'s own stored `storeId` (a snapshot, correct even if the employee is later reassigned), inclusive of both boundary dates.

```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "summary": { "present": 0, "absent": 0, "total": 0, "attendanceRate": 0 },
  "employees": [
    { "employeeId": "...", "employeeName": "...", "storeId": "...", "storeName": "...",
      "present": 0, "absent": 0, "total": 0, "attendanceRate": 0 }
  ]
}
```
Only employees with at least one attendance record in the period appear in `employees`. `attendanceRate` is `0`, never `NaN`/`Infinity`, when `total` is `0`.

### `GET /api/reports/payroll`

**Required:** `startDate`, `endDate`. **Optional:** `employeeId`, `storeId`, `status` (`DRAFT` | `FINALIZED`).

Uses existing `Payroll` rows as-is — **never recalculates or modifies them**. `startDate`/`endDate` select payroll whose *period* overlaps the requested window (`periodStart <= endDate AND periodEnd >= startDate`), not an exact match — a payroll period rarely aligns exactly with an arbitrary report window. Filtered by `Payroll`'s own stored `storeId`, same historical-accuracy reasoning as Attendance.

```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "summary": { "draftTotal": "0.00", "finalizedTotal": "0.00", "recordCount": 0 },
  "payroll": [
    { "payrollId": "...", "employeeId": "...", "employeeName": "...", "storeId": "...", "storeName": "...",
      "periodStart": "2026-01-01", "periodEnd": "2026-01-31", "totalWage": "0.00", "status": "FINALIZED" }
  ]
}
```
If `status` is supplied, both the list **and** the summary respect it — filtering to `DRAFT`, for example, correctly reports `finalizedTotal: "0.00"` rather than the organization's real finalized total. All monetary values are `Prisma.Decimal`, formatted to 2 decimal places, never JS floating point.

### `GET /api/reports/payments`

**Required:** `startDate`, `endDate`. **Optional:** `employeeId`.

`PaymentLedger` has no `storeId` column — scoped through `Employee → Store` (the employee's *current* store; no snapshot field exists for payments, unlike Attendance/Payroll). Date filtering uses `paidAt >= startDate AND paidAt < (endDate + 1 day)` — `paidAt` is a full timestamp, not a date, so this inclusive-upper-bound form is what keeps a payment recorded any time on the end date from being excluded.

```json
{
  "period": { "startDate": "2026-01-01", "endDate": "2026-01-31" },
  "summary": { "totalPaid": "0.00", "paymentCount": 0 },
  "payments": [
    { "paymentId": "...", "employeeId": "...", "employeeName": "...", "storeId": "...", "storeName": "...",
      "amount": "0.00", "paidAt": "2026-01-15T10:00:00.000Z", "note": null }
  ]
}
```
No outstanding-balance figure in this report — that's Dashboard's job (`GET /api/dashboard/summary`), which already reuses the Payment Ledger's own all-time balance rule; this report intentionally doesn't duplicate it.

### `GET /api/reports/workforce`

**Optional:** `storeId`, `activeOnly` (default `true`).

Current `Employee → Store` relationships only — not period-filtered, no date params at all.

```json
{
  "summary": { "totalEmployees": 0, "activeEmployees": 0, "inactiveEmployees": 0 },
  "employees": [
    { "employeeId": "...", "employeeName": "...", "storeId": "...", "storeName": "...",
      "dailyWage": "0.00", "joinedAt": "2026-01-15", "isActive": true }
  ]
}
```
`summary` always reports the true total/active/inactive counts regardless of `activeOnly`; `activeOnly` only affects which employees appear in the `employees` list (`true` = active only, `false` = everyone). Response is built from an explicit Prisma `select` — `passwordHash`, refresh tokens, and other sensitive `User` fields are never fetched in the first place, not fetched-then-stripped.
