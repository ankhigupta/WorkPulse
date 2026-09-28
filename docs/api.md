# API Reference

This file is being filled in incrementally, module by module, rather than all at once — each milestone documents only what it built, to avoid blocking implementation on retroactively writing up every prior module. It currently documents the Dashboard and Reports endpoints.

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

**A schema note that applies to all four:** there is no name field anywhere in the schema — `Employee` and `User` only have `email`. Every `employeeName` field below is the linked `User.email`, not a real name. This is a known, deliberate gap (confirmed with the user rather than silently worked around) — a future milestone would need to add a name field to `User` for this to show anything more meaningful.

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
