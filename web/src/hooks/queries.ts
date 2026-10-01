import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as accessRequestsApi from "../api/accessRequests";
import * as attendanceApi from "../api/attendance";
import * as employeesApi from "../api/employees";
import * as managersApi from "../api/managers";
import * as organizationsApi from "../api/organizations";
import * as payrollApi from "../api/payroll";
import * as reportsApi from "../api/reports";
import * as storesApi from "../api/stores";
import type { AccessRequestStatus } from "../types/domain";

// Prefix-based keys: invalidating ["employees"] also invalidates
// ["employees", id], same scheme the mobile app uses.
export const queryKeys = {
  organization: (id: string) => ["organization", id] as const,
  organizations: ["organizations"] as const,
  stores: ["stores"] as const,
  employees: ["employees"] as const,
  employee: (id: string) => ["employees", id] as const,
  managers: ["managers"] as const,
  manager: (id: string) => ["managers", id] as const,
  attendance: (filters: unknown) => ["attendance", filters] as const,
  corrections: (filters: unknown) => ["corrections", filters] as const,
  payroll: (filters: unknown) => ["payroll", filters] as const,
  payments: (filters: unknown) => ["payments", filters] as const,
  balance: (employeeId: string) => ["balance", employeeId] as const,
  accessRequests: (status?: AccessRequestStatus) => ["accessRequests", status ?? "all"] as const,
  employeeNotes: (employeeId?: string) => ["employeeNotes", employeeId ?? "all"] as const,
  dashboard: (range: unknown) => ["dashboard", range] as const,
  report: (kind: string, params: unknown) => ["report", kind, params] as const,
};

const LIST_STALE_TIME = 30_000;

export function useStores() {
  return useQuery({ queryKey: queryKeys.stores, queryFn: storesApi.listStores, staleTime: LIST_STALE_TIME });
}

export function useEmployees() {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: employeesApi.listEmployees,
    staleTime: LIST_STALE_TIME,
  });
}

export function useEmployee(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.employee(employeeId),
    queryFn: () => employeesApi.getEmployee(employeeId),
    staleTime: LIST_STALE_TIME,
  });
}

export function useManagers() {
  return useQuery({
    queryKey: queryKeys.managers,
    queryFn: managersApi.listManagers,
    staleTime: LIST_STALE_TIME,
  });
}

export function useManager(managerId: string) {
  return useQuery({
    queryKey: queryKeys.manager(managerId),
    queryFn: () => managersApi.getManager(managerId),
    staleTime: LIST_STALE_TIME,
  });
}

export function useOrganization(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.organization(organizationId ?? ""),
    queryFn: () => organizationsApi.getOrganization(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: organizationsApi.listOrganizations,
    staleTime: LIST_STALE_TIME,
  });
}

export function useDashboardSummary(range?: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: queryKeys.dashboard(range ?? "default"),
    queryFn: () => reportsApi.getDashboardSummary(range),
    staleTime: LIST_STALE_TIME,
  });
}

export function useCorrections(filters: attendanceApi.ListCorrectionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.corrections(filters),
    queryFn: () => attendanceApi.listCorrections(filters),
    staleTime: LIST_STALE_TIME,
  });
}

export function useAttendance(filters: attendanceApi.ListAttendanceFilters) {
  return useQuery({
    queryKey: queryKeys.attendance(filters),
    queryFn: () => attendanceApi.listAttendance(filters),
    staleTime: LIST_STALE_TIME,
  });
}

export function usePayroll(filters: payrollApi.ListPayrollFilters = {}) {
  return useQuery({
    queryKey: queryKeys.payroll(filters),
    queryFn: () => payrollApi.listPayroll(filters),
    staleTime: LIST_STALE_TIME,
  });
}

export function usePayments(filters: payrollApi.ListPaymentFilters = {}) {
  return useQuery({
    queryKey: queryKeys.payments(filters),
    queryFn: () => payrollApi.listPayments(filters),
    staleTime: LIST_STALE_TIME,
  });
}

export function useEmployeeBalance(employeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.balance(employeeId ?? ""),
    queryFn: () => payrollApi.getEmployeeBalance(employeeId as string),
    enabled: Boolean(employeeId),
  });
}

export function useAccessRequests(status?: AccessRequestStatus) {
  return useQuery({
    queryKey: queryKeys.accessRequests(status),
    queryFn: () => accessRequestsApi.listAccessRequests(status),
    staleTime: 15_000,
  });
}

export function useEmployeeNotes(employeeId?: string) {
  return useQuery({
    queryKey: queryKeys.employeeNotes(employeeId),
    queryFn: () => accessRequestsApi.listEmployeeNotes(employeeId),
    staleTime: LIST_STALE_TIME,
  });
}

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesApi.createEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees }),
  });
}

export function useUpdateEmployee(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: employeesApi.UpdateEmployeeInput) => employeesApi.updateEmployee(employeeId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees }),
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: storesApi.createStore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
  });
}

export function useUpdateStore(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: storesApi.UpdateStoreInput) => storesApi.updateStore(storeId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stores }),
  });
}

export function useCreateManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: managersApi.createManager,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.managers }),
  });
}

export function useUpdateManager(managerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: managersApi.UpdateManagerInput) => managersApi.updateManager(managerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.managers }),
  });
}

export function useCorrectionReview(action: "approve" | "reject") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (correctionId: string) =>
      action === "approve"
        ? attendanceApi.approveCorrection(correctionId)
        : attendanceApi.rejectCorrection(correctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corrections"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useApproveAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, input }: { requestId: string; input: accessRequestsApi.ApproveAccessRequestInput }) =>
      accessRequestsApi.approveAccessRequest(requestId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      queryClient.invalidateQueries({ queryKey: queryKeys.managers });
    },
  });
}

export function useRejectAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      accessRequestsApi.rejectAccessRequest(requestId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accessRequests"] }),
  });
}

export function useCreatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.createPayroll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });
}

export function usePayrollAction(action: "recalculate" | "finalize") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payrollId: string) =>
      action === "recalculate" ? payrollApi.recalculatePayroll(payrollId) : payrollApi.finalizePayroll(payrollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payrollApi.createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.createAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ORGANIZATION_ADMIN direct edit — updates the existing row. Reports share
// the ["report", ...] key prefix, so a plain prefix invalidation of
// "report" catches all four without listing them individually.
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attendanceId, status }: { attendanceId: string; status: "PRESENT" | "ABSENT" }) =>
      attendanceApi.updateAttendanceStatus(attendanceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useCreateEmployeeNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accessRequestsApi.createEmployeeNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employeeNotes"] }),
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; isActive?: boolean }) =>
      organizationsApi.updateOrganization(organizationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organization(organizationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
}
