import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as correctionsApi from "../api/attendanceCorrections";
import type { CreateCorrectionInput, ListCorrectionsParams } from "../types/attendanceCorrection";

export const correctionsKey = (params: ListCorrectionsParams) => ["attendanceCorrections", params] as const;

export function useCorrectionsList(params: ListCorrectionsParams) {
  return useQuery({
    queryKey: correctionsKey(params),
    queryFn: () => correctionsApi.listCorrections(params),
    staleTime: 15_000,
  });
}

export function useCreateCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCorrectionInput) => correctionsApi.createCorrection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendanceCorrections"] });
    },
  });
}

export function useApproveCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (correctionId: string) => correctionsApi.approveCorrection(correctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendanceCorrections"] });
      // Approval is the one action that actually changes Attendance.status
      // — every cached attendance list is invalidated too, so the
      // Attendance screen shows the real new status next time it's viewed.
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: () => {
      // A 409 here means someone else already processed this correction —
      // refetch so the UI shows the real current state instead of a stale
      // "still PENDING" row with a now-broken Approve button.
      queryClient.invalidateQueries({ queryKey: ["attendanceCorrections"] });
    },
  });
}

export function useRejectCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (correctionId: string) => correctionsApi.rejectCorrection(correctionId),
    onSuccess: () => {
      // Rejection never touches Attendance — only the correction itself
      // needs invalidating.
      queryClient.invalidateQueries({ queryKey: ["attendanceCorrections"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["attendanceCorrections"] });
    },
  });
}
