/*
  Hand-edited from the Prisma-generated draft.

  Prisma's own draft would have added `name` as NOT NULL with no default,
  which fails outright on any non-empty Employee table. This version adds
  the column nullable first, backfills every existing row, then locks it
  down — safe regardless of how many Employee rows already exist.

  Backfill source: every Employee row that existed before this migration
  is guaranteed to have had a non-null userId (it was a required column
  until this exact migration relaxes it), so every pre-existing row can
  be backfilled from its linked User's email. This is a ONE-TIME
  migration convenience value, not a real name — see docs/database.md
  and docs/decisions.md for why, and application code requires a real
  human name on every Employee created from this point forward.

  No existing Employee/Attendance/Payroll/PaymentLedger/EmployeeNote rows
  are deleted or have their IDs changed by this migration.
*/

-- AlterTable: add `name` nullable first (not NOT NULL yet), and relax
-- `userId` to optional. The unique index on `userId` is untouched —
-- Postgres unique indexes already permit multiple NULLs natively, so an
-- employee with no linked account doesn't collide with another employee
-- that also has none, while two employees still can't share one account.
ALTER TABLE "Employee" ADD COLUMN "name" TEXT;
ALTER TABLE "Employee" ALTER COLUMN "userId" DROP NOT NULL;

-- Backfill: only rows that would otherwise violate the upcoming NOT NULL
-- constraint. Every existing row has a non-null userId at this point in
-- the migration (see comment above), so this covers 100% of pre-existing
-- Employee rows.
UPDATE "Employee" e
SET "name" = u."email"
FROM "User" u
WHERE e."userId" = u."id"
  AND e."name" IS NULL;

-- Enforce NOT NULL now that every row is guaranteed to have a value.
ALTER TABLE "Employee" ALTER COLUMN "name" SET NOT NULL;
