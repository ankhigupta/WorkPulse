// Mirrors backend/src/modules/payments/payment.service.ts's paymentSelect
// exactly. No employee name (resolved client-side from the employee
// cache, same pattern as Attendance/Payroll). recordedByUserId is a raw
// actor id with no endpoint to resolve it to a name — never shown.
export interface Payment {
  id: string;
  employeeId: string;
  organizationId: string;
  // Prisma.Decimal serializes to a JSON string — never parsed into a
  // number for anything beyond display formatting.
  amount: string;
  // A real instant (paid date+time), not a calendar date.
  paidAt: string;
  note: string | null;
  recordedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

// Mirrors listPaymentsQuerySchema.
export interface ListPaymentsParams {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}

// Mirrors createPaymentSchema exactly. Note the backend requires `amount`
// as a plain JSON number (z.number(), not z.coerce.number()) — a numeric
// string is rejected outright, not coerced. The mobile form still treats
// the amount as text end-to-end and only converts to a number once, right
// at submission, purely to match this wire shape — never for arithmetic.
export interface CreatePaymentInput {
  employeeId: string;
  amount: number;
  paidAt: string;
  note?: string;
}

// Mirrors payment.controller.ts's getBalance response exactly — all three
// fields are pre-stringified Decimal values from the backend. outstanding
// is always all-time (unbounded by any date filter), never derived
// client-side.
export interface EmployeeBalance {
  totalOwed: string;
  totalPaid: string;
  outstanding: string;
}
