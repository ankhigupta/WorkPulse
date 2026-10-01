import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as attendanceApi from "../api/attendance";
import type { CreateAttendanceInput, ListAttendanceParams, UpdateAttendanceStatusInput } from "../types/attendance";

// Keyed by the actual filter object — a different `date` produces a
// different query key, so switching dates fetches (and caches) that date's
// data independently rather than reusing/overwriting a single shared key.
export const attendanceKey = (params: ListAttendanceParams) => ["attendance", params] as const;

export function useAttendanceList(params: ListAttendanceParams) {
  return useQuery({
    queryKey: attendanceKey(params),
    queryFn: () => attendanceApi.listAttendance(params),
    staleTime: 15_000,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAttendanceInput) => attendanceApi.createAttendance(input),
    onSuccess: () => {
      // Prefix match invalidates every cached date/filter combination, not
      // just the one the form happened to submit for.
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useUpdateAttendanceStatus(attendanceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAttendanceStatusInput) => attendanceApi.updateAttendanceStatus(attendanceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}
