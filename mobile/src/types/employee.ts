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

// Mirrors backend/src/modules/employees/employee.schemas.ts's createEmployeeSchema.
// email/password must be supplied together or not at all — validated the
// same way client-side before ever hitting the API.
export interface CreateEmployeeInput {
  name: string;
  storeId: string;
  dailyWage: number;
  joinedAt: string;
  email?: string;
  password?: string;
}

// Mirrors updateEmployeeSchema — deliberately has no email/password fields.
// The update endpoint doesn't accept them; linking/changing a login account
// isn't part of this API.
export interface UpdateEmployeeInput {
  name?: string;
  storeId?: string;
  dailyWage?: number;
  joinedAt?: string;
  isActive?: boolean;
}
