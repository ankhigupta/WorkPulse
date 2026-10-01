import { apiClient } from "./client";
import type {
  Attendance,
  CreateAttendanceInput,
  ListAttendanceParams,
  UpdateAttendanceStatusInput,
} from "../types/attendance";

export async function listAttendance(params: ListAttendanceParams): Promise<Attendance[]> {
  const { data } = await apiClient.get<Attendance[]>("/attendance", { params });
  return data;
}

export async function createAttendance(input: CreateAttendanceInput): Promise<Attendance> {
  const { data } = await apiClient.post<Attendance>("/attendance", input);
  return data;
}

// ORGANIZATION_ADMIN-only direct edit — updates the existing row, never
// creates a second one. See attendance.service.ts's updateAttendanceForAuth.
export async function updateAttendanceStatus(
  attendanceId: string,
  input: UpdateAttendanceStatusInput,
): Promise<Attendance> {
  const { data } = await apiClient.patch<Attendance>(`/attendance/${attendanceId}`, input);
  return data;
}
