import type { Role } from "./auth";

// Mirrors backend/src/modules/employees/employee.service.ts's employeeSelect.
// Employee is a workforce identity, independent of login — `user` is null for
// any employee with no account. Never derive display name from `user.email`;
// `name` is the real identity field. dailyWage arrives as a decimal string
// (Prisma.Decimal is serialized to JSON as a string), not a number.
export interface Employee {
  id: string;
  organizationId: string;
  storeId: string;
  name: string;
  dailyWage: string;
  qrCodeToken: string;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
  } | null;
}
