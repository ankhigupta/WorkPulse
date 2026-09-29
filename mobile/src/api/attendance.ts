import { apiClient } from "./client";
import type { Attendance, CreateAttendanceInput, ListAttendanceParams } from "../types/attendance";

export async function listAttendance(params: ListAttendanceParams): Promise<Attendance[]> {
  const { data } = await apiClient.get<Attendance[]>("/attendance", { params });
  return data;
}

export async function createAttendance(input: CreateAttendanceInput): Promise<Attendance> {
  const { data } = await apiClient.post<Attendance>("/attendance", input);
  return data;
}
