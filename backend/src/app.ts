import express from "express";
import { errorHandler } from "./common/middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";

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

// Must be last: catches errors thrown/forwarded by every route above.
app.use(errorHandler);

export default app;