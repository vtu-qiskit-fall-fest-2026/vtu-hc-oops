
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import loadRoutes from "./routes/loadRoutes.js";
import truckRoutes from "./routes/truckRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import brokerRoutes from "./routes/brokerRoutes.js";
import transporterRoutes from "./routes/transporterRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";

const app = express();
const port = process.env.PORT || 5000;

app.disable("x-powered-by");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "10kb" }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "LOADSETU API" });
});

// Register API routes BEFORE the 404 handler.
app.use("/api/auth", authRoutes);
app.use("/api/loads", loadRoutes);
app.use("/api/trucks", truckRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/transporter", transporterRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/routes", routeRoutes);

// Handle unknown routes only after registering all API routes.
app.use((req, res) => {
  res.status(404).json({ message: "Page not found." });
});

// Handle unexpected server errors.
app.use((err, _req, res, _next) => {
  if (err?.name === "MulterError") {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Each verification document must be 5 MB or smaller." : "The uploaded verification documents could not be accepted." });
  }
  if (err?.message === "Upload PDF, JPG or PNG documents only.") return res.status(400).json({ message: err.message });
  console.error("Unhandled LOADSETU API error:", err?.message || "unknown error");
  res.status(err?.status || 500).json({ message: err?.status ? err.message : "Something went wrong. Please try again." });
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`LOADSETU API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  });
