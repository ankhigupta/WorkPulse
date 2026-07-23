import express from "express";

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

export default app;