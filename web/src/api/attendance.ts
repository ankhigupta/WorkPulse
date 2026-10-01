import { apiClient } from "./client";
import type { Attendance, AttendanceCorrection, AttendanceStatus, CorrectionStatus } from "../types/domain";

export interface ListAttendanceFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  storeId?: string;
  status?: AttendanceStatus;
}

export interface CreateAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  method: "QR" | "MANUAL";
  checkInAt?: string;
}

export async function listAttendance(filters: ListAttendanceFilters = {}): Promise<Attendance[]> {
  const { data } = await apiClient.get<Attendance[]>("/attendance", { params: filters });
  return data;
}

export async function createAttendance(input: CreateAttendanceInput): Promise<Attendance> {
  const { data } = await apiClient.post<Attendance>("/attendance", input);
  return data;
}

// ORGANIZATION_ADMIN-only direct edit — updates the existing row in place.
// The backend independently enforces the role; this is the only client
// that ever sends `status` here (web has no STORE_MANAGER session at all).
export async function updateAttendanceStatus(
  attendanceId: string,
  status: AttendanceStatus,
): Promise<Attendance> {
  const { data } = await apiClient.patch<Attendance>(`/attendance/${attendanceId}`, { status });
  return data;
}

export interface ListCorrectionFilters {
  status?: CorrectionStatus;
  employeeId?: string;
  attendanceId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
}

export async function listCorrections(filters: ListCorrectionFilters = {}): Promise<AttendanceCorrection[]> {
  const { data } = await apiClient.get<AttendanceCorrection[]>("/attendance-corrections", {
    params: filters,
  });
  return data;
}

export async function approveCorrection(correctionId: string): Promise<AttendanceCorrection> {
  const { data } = await apiClient.post<AttendanceCorrection>(
    `/attendance-corrections/${correctionId}/approve`,
  );
  return data;
}

export async function rejectCorrection(correctionId: string): Promise<AttendanceCorrection> {
  const { data } = await apiClient.post<AttendanceCorrection>(
    `/attendance-corrections/${correctionId}/reject`,
  );
  return data;
}
