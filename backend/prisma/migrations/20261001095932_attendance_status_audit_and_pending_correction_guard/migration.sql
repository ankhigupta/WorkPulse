-- AlterTable
-- Nullable audit columns: who last changed Attendance.status after
-- creation (a direct ORGANIZATION_ADMIN edit or an approved correction),
-- and when. Null for every row until either happens for the first time.
ALTER TABLE "Attendance" ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedByUserId" UUID;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_statusChangedByUserId_fkey" FOREIGN KEY ("statusChangedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
-- Hand-added: Prisma's schema DSL cannot express a WHERE-qualified unique
-- index (see the comment on AttendanceCorrection in schema.prisma). At
-- most one PENDING correction may exist per attendance record at a time —
-- APPROVED/REJECTED rows are excluded so a resolved correction never
-- blocks a later, legitimate one. This is the database-level guarantee
-- behind "do not allow conflicting duplicate correction requests."
CREATE UNIQUE INDEX "AttendanceCorrection_pending_attendanceId_key" ON "AttendanceCorrection"("attendanceId") WHERE "status" = 'PENDING';
