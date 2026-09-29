import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as paymentsApi from "../api/payments";
import type { CreatePaymentInput, ListPaymentsParams } from "../types/payment";

export const paymentsKey = (params: ListPaymentsParams) => ["payments", params] as const;
export const balanceKey = (employeeId: string) => ["payments", "balance", employeeId] as const;

export function usePaymentsList(params: ListPaymentsParams) {
  return useQuery({
    queryKey: paymentsKey(params),
    queryFn: () => paymentsApi.listPayments(params),
    staleTime: 15_000,
  });
}

export function useEmployeeBalance(employeeId: string) {
  return useQuery({
    queryKey: balanceKey(employeeId),
    queryFn: () => paymentsApi.getEmployeeBalance(employeeId),
    staleTime: 15_000,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentInput) => paymentsApi.createPayment(input),
    onSuccess: () => {
      // Prefix match — covers every cached payment list AND every cached
      // employee balance (["payments", "balance", id] starts with
      // ["payments"]), so the balance the admin just paid against always
      // reflects the real new server state, never a locally-decremented guess.
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: () => {
      // Covers both real cases this can fire for: an overpayment rejection
      // (nothing changed, but the displayed balance should still be
      // confirmed fresh) and a concurrent-payment conflict (something *did*
      // change server-side that this request lost the race against).
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
