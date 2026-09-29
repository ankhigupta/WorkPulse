import { Navigate, Route, Routes } from "react-router-dom";
import { OrganizationAdminShell, RoleAwareShell, SuperAdminShell } from "./AppShell";
import { RedirectIfAuthenticated, RequireRole, RootRedirect } from "./guards";
import { LoginPage } from "../modules/auth/LoginPage";
import { NotFoundPage } from "../modules/auth/NotFoundPage";
import { OrgSignupPage } from "../modules/auth/OrgSignupPage";
import { RoleNotSupportedPage } from "../modules/auth/RoleNotSupportedPage";
import { DashboardPage } from "../modules/dashboard/DashboardPage";
import { EmployeesPage } from "../modules/employees/EmployeesPage";
import { EmployeeDetailPage } from "../modules/employees/EmployeeDetailPage";
import { ManagerDetailPage, ManagersPage } from "../modules/managers/ManagersPage";
import { StoreDetailPage, StoresPage } from "../modules/stores/StoresPage";
import { AttendancePage } from "../modules/attendance/AttendancePage";
import { CorrectionsPage } from "../modules/attendance/CorrectionsPage";
import { PayrollPage } from "../modules/payroll/PayrollPage";
import { PaymentsPage } from "../modules/payments/PaymentsPage";
import {
  AttendanceReportPage,
  PaymentsReportPage,
  PayrollReportPage,
  ReportsLayout,
  WorkforceReportPage,
} from "../modules/reports/ReportsPage";
import { EmployeeNotesPage } from "../modules/employeeNotes/EmployeeNotesPage";
import { AccessRequestsPage } from "../modules/accessRequests/AccessRequestsPage";
import { OrganizationPage } from "../modules/organization/OrganizationPage";
import { AccountPage } from "../modules/account/AccountPage";
import {
  SuperOrganizationDetailPage,
  SuperOrganizationsPage,
} from "../modules/superAdmin/OrganizationsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/signup/organization"
        element={
          <RedirectIfAuthenticated>
            <OrgSignupPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/role-unsupported" element={<RoleNotSupportedPage />} />

      {/* Organization administration */}
      <Route
        element={
          <RequireRole roles={["ORGANIZATION_ADMIN"]}>
            <OrganizationAdminShell />
          </RequireRole>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:employeeId" element={<EmployeeDetailPage />} />
        <Route path="/managers" element={<ManagersPage />} />
        <Route path="/managers/:managerId" element={<ManagerDetailPage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/stores/:storeId" element={<StoreDetailPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/attendance/corrections" element={<CorrectionsPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/reports" element={<ReportsLayout />}>
          <Route index element={<Navigate to="/reports/attendance" replace />} />
          <Route path="attendance" element={<AttendanceReportPage />} />
          <Route path="payroll" element={<PayrollReportPage />} />
          <Route path="payments" element={<PaymentsReportPage />} />
          <Route path="workforce" element={<WorkforceReportPage />} />
        </Route>
        <Route path="/employee-notes" element={<EmployeeNotesPage />} />
        <Route path="/access-requests" element={<AccessRequestsPage />} />
        <Route path="/organization" element={<OrganizationPage />} />
      </Route>

      {/* Platform administration — deliberately no overlap with the routes above */}
      <Route
        element={
          <RequireRole roles={["SUPER_ADMIN"]}>
            <SuperAdminShell />
          </RequireRole>
        }
      >
        <Route path="/super/organizations" element={<SuperOrganizationsPage />} />
        <Route path="/super/organizations/:organizationId" element={<SuperOrganizationDetailPage />} />
      </Route>

      {/* Account is the one screen both web roles share. */}
      <Route
        element={
          <RequireRole roles={["ORGANIZATION_ADMIN", "SUPER_ADMIN"]}>
            <RoleAwareShell />
          </RequireRole>
        }
      >
        <Route path="/account" element={<AccountPage />} />
      </Route>

      <Route path="/not-found" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
