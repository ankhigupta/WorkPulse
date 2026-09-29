import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as payrollApi from "../api/payroll";
import type { CreatePayrollInput, ListPayrollParams } from "../types/payroll";

export const payrollKey = (params: ListPayrollParams) => ["payroll", params] as const;

export function usePayrollList(params: ListPayrollParams) {
  return useQuery({
    queryKey: payrollKey(params),
    queryFn: () => payrollApi.listPayroll(params),
    staleTime: 15_000,
  });
}

export function useCreatePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePayrollInput) => payrollApi.createPayroll(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });
}

export function useRecalculatePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payrollId: string) => payrollApi.recalculatePayroll(payrollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: () => {
      // A conflict here means the record was finalized out from under this
      // request — refetch so the card reflects the real current status
      // instead of a stale "still DRAFT" row.
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });
}

export function useFinalizePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payrollId: string) => payrollApi.finalizePayroll(payrollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });
}
