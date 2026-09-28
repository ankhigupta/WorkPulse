# Database Design

Status: schema defined in `backend/prisma/schema.prisma`. See `backend/prisma/migrations/` for the full, ordered migration history. Most recent: `employee_optional_user_and_name` (see "Employee ≠ User" below).

## Entity overview

| Entity | Represents | Notes |
|---|---|---|
| Organization | Tenant root | never physically deleted, `isActive` lifecycle |
| User | Login/account identity for all 4 roles | `email` globally unique, `organizationId` nullable (SUPER_ADMIN only) |
| Store | Physical location under an Organization | `(organizationId, name)` unique |
| Employee | Wage-earning workforce record | belongs to Store, has `name`/`dailyWage`/`qrCodeToken`; **User link is optional** — see below |
| Manager | Operational workforce record | 1:1 with User, belongs to Store, **no wage/payroll fields** |
| EmployeeNote | Free-text note about an employee | append-only, no `isActive`, no `organizationId` (derived via Employee) |
| Attendance | Daily attendance fact | one row per employee per calendar day, immutable once created |
| AttendanceCorrection | Requested change to an Attendance row | permanent audit record, never overwrites Attendance directly |
| Payroll | Computed wage liability for a period | `DRAFT` → `FINALIZED` lifecycle |
| PaymentLedger | Actual money paid to an employee | balance computed at query time, never stored |
| RefreshToken | Opaque refresh token for session renewal | stores a SHA-256 hash, not the raw token; belongs to a User |

Roles: `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `STORE_MANAGER`, `EMPLOYEE` (`Role` enum on `User`).

## Relationships

```
Organization
    |
    +--(1:N)-- User (organizationId nullable; SUPER_ADMIN has none)
    |
    +--(1:N)-- Store
                 |
                 +--(1:N)-- Employee --(0..1:1)-- User  [optional — see "Employee ≠ User"]
                 |             |
                 |             +--(1:N)-- EmployeeNote --(author, N:1)--> User
                 |             +--(1:N)-- Attendance --(N:1)--> Store
                 |             |              |
                 |             |              +--(1:N)-- AttendanceCorrection --(N:1)--> User
                 |             +--(1:N)-- Payroll --(N:1)--> Store
                 |             +--(1:N)-- PaymentLedger --(N:1)--> User (recordedBy)
                 |
                 +--(1:N)-- Manager --(1:1)-- User
```

## Tenant isolation strategy

`organizationId` is denormalized onto every tenant-scoped table (Store, Employee, Manager, Attendance, AttendanceCorrection, Payroll, PaymentLedger, and User where applicable) so every authorization check is a single `WHERE organizationId = :currentOrgId` predicate — no join required, no risk of a forgotten join leaking cross-tenant data.

That denormalization is enforced at the database level, not just trusted at the application layer, using **composite foreign keys**: the parent table exposes `@@unique([id, organizationId])`, and the child references both columns (`@relation(fields: [storeId, organizationId], references: [id, organizationId])`). Postgres then rejects any row whose declared `organizationId` doesn't match the actual organization of the row it references.

Applied to the ownership/ancestry chain:
- `Employee` → `Store`, `Employee` → `User`
- `Manager` → `Store`, `Manager` → `User`
- `Attendance` → `Store`, `Attendance` → `Employee` (both required — together they force the store and the employee on one Attendance row to belong to the same org, which a single composite FK alone would not guarantee)
- `AttendanceCorrection` → `Attendance`
- `Payroll` → `Store`, `Payroll` → `Employee`
- `PaymentLedger` → `Employee`

Deliberately **not** applied to actor/audit fields (`Attendance.markedByUserId`, `AttendanceCorrection.requestedByUserId`/`reviewedByUserId`, `PaymentLedger.recordedByUserId`, `Payroll.finalizedByUserId`) — those stay plain FKs to `User.id`. They record "who did this," not tenant ownership, and `User.organizationId` is nullable (SUPER_ADMIN), making composite enforcement there low-value complexity.

`EmployeeNote` has no `organizationId` at all — tenant ownership is derived through `Employee`, and the blast radius of a missed join there is negligible (always accessed via an already-authorized Employee).

## Historical-data strategy

Nothing below Organization is ever physically deleted. `isActive` handles lifecycle for `Organization`, `User`, `Store`, `Employee`, `Manager`. Every foreign key from a historical/workforce table back to its parent uses `onDelete: Restrict` — no `CASCADE`, no `SetNull` anywhere in the schema — so deleting a row that historical data depends on fails at the database level, not just by convention.

The one genuine snapshot in the schema: `Attendance.storeId` is stored independently of `Employee.storeId`, because an employee can change stores later and past attendance must stay pinned to where it actually happened. `Payroll.totalWage`/`totalDaysPresent` are also intentionally stored (not recomputed on read) because `Employee.dailyWage` can change over time — a payroll period must freeze the rate that applied during that period.

## Important constraints

- `User.email` — globally unique.
- `Employee.userId` — unique **and nullable**. Postgres unique indexes permit any number of `NULL`s, so many account-less employees can coexist, while an employee that *does* have an account still can't share it with another employee.
- `Manager.userId` — unique, required (1:1 with User — managers always log in to operate the app).
- `Employee.qrCodeToken` — unique, opaque (`uuid()` default), not derived from the employee's own id.
- `Store(organizationId, name)` — unique per organization, not globally.
- `Attendance(employeeId, date)` — unique; the constraint that makes payroll math trustworthy (one attendance record per employee per calendar day).
- `Payroll(employeeId, periodStart, periodEnd)` — unique; prevents duplicate generation for the same period.
- `@@unique([id, organizationId])` on `User`, `Store`, `Employee`, `Attendance` — composite-FK targets only, not standalone business constraints.

## Employee ≠ User

An `Employee` is a **workforce identity** — a person who works at a store, has a wage, and appears in attendance/payroll/payments. A `User` is a **login identity** — email, password hash, role, and everything needed to authenticate into WorkPulse. These are separate concepts, and `Employee.userId` is optional precisely because not every real employee has (or needs) a login:

- Some employees have no phone, no email, and no smartphone, and will never log into WorkPulse themselves.
- Their `STORE_MANAGER` records their attendance manually (`POST /api/attendance`) exactly as for any other employee — attendance, payroll, and payments never require `Employee.user` to exist.
- `ORGANIZATION_ADMIN` creates the `Employee` record (`name`, store, wage) and *optionally* provisions a login account in the same request by also supplying `email`+`password` — both together, or neither.
- `Employee.name` is the employee's real, human-readable identity, independent of any account. It is never derived from `User.email`.

The composite foreign key `Employee(userId, organizationId) → User(id, organizationId)` still applies whenever `userId` is set — Postgres's standard composite-FK behavior (`MATCH SIMPLE`) means the constraint is simply not evaluated for a row where `userId` is `NULL`, so there's no special-case logic needed anywhere for this to work correctly.

**Migration note**: the `name` column was added as a required field after employees already existed in principle (via `Employee.userId` being mandatory until this change). The migration (`employee_optional_user_and_name`) backfills `name` from each existing employee's linked `User.email` as a one-time, temporary value — this is a migration convenience, not a real name, and does not apply to any employee created after this migration. There were zero existing `Employee` rows in this database when the migration ran, so this path was verified structurally but not exercised against real data.

## Payroll lifecycle

`Payroll.status`: `DRAFT` → `FINALIZED`.

- **DRAFT** — provisional. If an attendance correction is approved for a date inside a DRAFT period, the existing Payroll row is recalculated and updated in place (same id, same unique tuple) rather than replaced.
- **FINALIZED** — sets `finalizedAt` + `finalizedByUserId`, then treated as immutable historical fact. The application layer must refuse further mutation; a correction landing inside a finalized period is blocked/flagged for manual reconciliation rather than triggering an automatic recompute. No adjustment-ledger table — kept intentionally minimal for V1.

## Status

All entities in this document are implemented, migrated, and have a full service/route layer. See `docs/api.md` for the (incrementally documented) API surface.
