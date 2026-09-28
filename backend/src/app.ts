import express from "express";
import { errorHandler } from "./common/middleware/errorHandler";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import attendanceCorrectionRoutes from "./modules/attendanceCorrections/attendanceCorrection.routes";
import authRoutes from "./modules/auth/auth.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import employeeNoteRoutes from "./modules/employeeNotes/employeeNote.routes";
import managerRoutes from "./modules/managers/manager.routes";
import organizationRoutes from "./modules/organizations/organization.routes";
import paymentRoutes from "./modules/payments/payment.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import storeRoutes from "./modules/stores/store.routes";

const app = express();

// Middleware
app.use(express.json());

// Health Check Route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "WorkPulse API is running 🚀",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/attendance-corrections", attendanceCorrectionRoutes);
app.use("/api/employee-notes", employeeNoteRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/payments", paymentRoutes);

// Must be last: catches errors thrown/forwarded by every route above.
app.use(errorHandler);

export default app;