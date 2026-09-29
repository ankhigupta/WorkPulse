-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: joinCode added nullable first, backfilled, then locked to
-- NOT NULL — safe against any pre-existing Organization rows, mirroring
-- the pattern used for Employee.name in the earlier identity-refinement
-- migration. There were zero Organization rows in this database at
-- migration time, but this stays correct regardless of row count.
ALTER TABLE "Organization" ADD COLUMN "joinCode" TEXT;

-- One-time backfill only, for rows that predate this migration. Every
-- Organization created after this migration gets its joinCode from
-- application code (organization.service.ts's generateJoinCode), which
-- uses a manual-entry-friendly alphabet (excludes 0/O/1/I/L for legibility)
-- instead of this raw-hex fallback. gen_random_uuid() is a CSPRNG built
-- into Postgres 13+ (no extension required) — used here purely as a
-- convenient source of cryptographic randomness, not as an identifier
-- derived from anything about the row itself.
UPDATE "Organization"
SET "joinCode" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE "joinCode" IS NULL;

ALTER TABLE "Organization" ALTER COLUMN "joinCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_joinCode_key" ON "Organization"("joinCode");

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "requestedRole" "Role" NOT NULL,
    "requestedName" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "statusTokenHash" TEXT NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_createdUserId_key" ON "AccessRequest"("createdUserId");

-- CreateIndex
CREATE INDEX "AccessRequest_organizationId_status_idx" ON "AccessRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");

-- Partial unique index: at most one PENDING request per (email,
-- organizationId). Prisma's schema DSL has no way to declare a partial
-- (WHERE-qualified) unique index, so this is hand-added SQL — the actual,
-- enforced database-level constraint has no representation in
-- schema.prisma beyond the comment there pointing back to this file.
-- APPROVED/REJECTED rows are deliberately excluded from this constraint:
-- historical requests are preserved permanently and must never block a
-- new PENDING one for the same person/org.
CREATE UNIQUE INDEX "AccessRequest_pending_email_organizationId_key"
  ON "AccessRequest"("email", "organizationId")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
