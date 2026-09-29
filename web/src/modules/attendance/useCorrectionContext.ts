import { useMemo } from "react";
import { useAttendance, useEmployees, useStores } from "../../hooks/queries";
import type { AttendanceCorrection } from "../../types/domain";
import { todayDateOnly } from "../../utils/format";

export interface CorrectionDetail {
  employeeId: string;
  employeeName: string;
  storeId: string;
  storeName: string;
  date: string;
  currentStatus: "PRESENT" | "ABSENT";
}

const LOOKBACK_DAYS = 90;

function lookbackStartDate(): string {
  const start = new Date();
  start.setDate(start.getDate() - LOOKBACK_DAYS);
  return start.toISOString().slice(0, 10);
}

/*
 * An AttendanceCorrection row carries only attendanceId — employee, store
 * and date all live on the Attendance record it points at. Rather than
 * fetching each one (an N+1 request storm on a busy corrections list),
 * this pulls one bounded attendance window plus the already-cached
 * employee and store lists and joins them in memory: three requests total,
 * regardless of how many corrections are on screen. Same bounded-join
 * approach the mobile app settled on (ADR-010).
 *
 * A correction older than the window resolves to undefined rather than a
 * wrong value, and callers fall back to neutral labels.
 */
export function useCorrectionContext(corrections: AttendanceCorrection[]) {
  const attendanceQuery = useAttendance({ startDate: lookbackStartDate(), endDate: todayDateOnly() });
  const employeesQuery = useEmployees();
  const storesQuery = useStores();

  const byCorrectionId = useMemo(() => {
    const attendanceById = new Map((attendanceQuery.data ?? []).map((record) => [record.id, record]));
    const employeeById = new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee]));
    const storeById = new Map((storesQuery.data ?? []).map((store) => [store.id, store]));

    const result: Record<string, CorrectionDetail | undefined> = {};

    for (const correction of corrections) {
      const attendance = attendanceById.get(correction.attendanceId);
      if (!attendance) continue;

      result[correction.id] = {
        employeeId: attendance.employeeId,
        employeeName: employeeById.get(attendance.employeeId)?.name ?? "Unknown employee",
        storeId: attendance.storeId,
        storeName: storeById.get(attendance.storeId)?.name ?? "Unknown store",
        date: attendance.date,
        currentStatus: attendance.status,
      };
    }

    return result;
  }, [corrections, attendanceQuery.data, employeesQuery.data, storesQuery.data]);

  return {
    byCorrectionId,
    isLoading: attendanceQuery.isPending || employeesQuery.isPending || storesQuery.isPending,
  };
}
