# API Reference

This file is being filled in incrementally, module by module, rather than all at once — each milestone documents only what it built, to avoid blocking implementation on retroactively writing up every prior module. It currently documents only the Dashboard endpoint.

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
