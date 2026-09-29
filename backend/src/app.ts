import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { env } from "./common/config/env";
import { errorHandler } from "./common/middleware/errorHandler";
import accessRequestRoutes from "./modules/accessRequests/accessRequest.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import attendanceCorrectionRoutes from "./modules/attendanceCorrections/attendanceCorrection.routes";
import authRoutes from "./modules/auth/auth.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import employeeNoteRoutes from "./modules/employeeNotes/employeeNote.routes";
import managerRoutes from "./modules/managers/manager.routes";
import organizationRoutes from "./modules/organizations/organization.routes";
import paymentRoutes from "./modules/payments/payment.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import storeRoutes from "./modules/stores/store.routes";

const app = express();

// Middleware
app.use(helmet());

// Exact-origin allowlist, never a wildcard: `credentials: true` is
// required for the web refresh cookie, and the CORS spec forbids pairing
// that with "*". A request with no Origin at all (mobile, server-to-server,
// curl) is allowed through unchanged — those clients aren't subject to the
// same-origin policy and never carry an ambient browser credential.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.WEB_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-WorkPulse-Client"],
  }),
);

app.use(express.json());
app.use(cookieParser());

// Health Check Route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "WorkPulse API is running 🚀",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/access-requests", accessRequestRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/attendance-corrections", attendanceCorrectionRoutes);
app.use("/api/employee-notes", employeeNoteRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);

// Must be last: catches errors thrown/forwarded by every route above.
app.use(errorHandler);

export default app;