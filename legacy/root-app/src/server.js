
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
import brokerVerificationRoutes from "./routes/brokerVerificationRoutes.js";

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

app.use(express.json({ limit: "9mb" }));

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
app.use("/api/broker/verification", brokerVerificationRoutes);

// Handle unknown routes only after registering all API routes.
app.use((req, res) => {
  res.status(404).json({ message: "Page not found." });
});

// Handle unexpected server errors.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: "Something went wrong. Please try again.",
  });
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
