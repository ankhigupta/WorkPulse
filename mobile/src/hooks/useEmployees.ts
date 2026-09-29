import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as employeesApi from "../api/employees";
import type { CreateEmployeeInput, Employee, UpdateEmployeeInput } from "../types/employee";

// Simple, fuzzy-matchable key scheme: invalidating ["employees"] also
// invalidates every ["employees", id] detail query (TanStack Query's
// default invalidateQueries match is prefix-based), so create/update only
// ever need to invalidate the one root key.
export const employeesKey = ["employees"] as const;
export const employeeDetailKey = (employeeId: string) => ["employees", employeeId] as const;

export function useEmployeeList() {
  return useQuery({
    queryKey: employeesKey,
    queryFn: employeesApi.listEmployees,
    staleTime: 30_000,
  });
}

export function useEmployee(employeeId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: employeeDetailKey(employeeId),
    queryFn: () => employeesApi.getEmployee(employeeId),
    // The list endpoint returns the exact same shape as the detail
    // endpoint — if we already have this employee from a loaded list,
    // show it instantly instead of a loading spinner while this query
    // still revalidates against the real detail endpoint in the background.
    initialData: () => queryClient.getQueryData<Employee[]>(employeesKey)?.find((e) => e.id === employeeId),
    staleTime: 30_000,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeesApi.createEmployee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey });
    },
  });
}

export function useUpdateEmployee(employeeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => employeesApi.updateEmployee(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey });
    },
  });
}
