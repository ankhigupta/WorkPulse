import { apiClient } from "./client";
import type { AttendanceCorrection, CreateCorrectionInput, ListCorrectionsParams } from "../types/attendanceCorrection";

export async function listCorrections(params: ListCorrectionsParams): Promise<AttendanceCorrection[]> {
  const { data } = await apiClient.get<AttendanceCorrection[]>("/attendance-corrections", { params });
  return data;
}

export async function createCorrection(input: CreateCorrectionInput): Promise<AttendanceCorrection> {
  const { data } = await apiClient.post<AttendanceCorrection>("/attendance-corrections", input);
  return data;
}

export async function approveCorrection(correctionId: string): Promise<AttendanceCorrection> {
  const { data } = await apiClient.post<AttendanceCorrection>(`/attendance-corrections/${correctionId}/approve`);
  return data;
}

export async function rejectCorrection(correctionId: string): Promise<AttendanceCorrection> {
  const { data } = await apiClient.post<AttendanceCorrection>(`/attendance-corrections/${correctionId}/reject`);
  return data;
}
