import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import config from "./config/config.js";
import transactionsRouter from "./routes/transactions.js";
import plannedExpensesRouter from "./routes/plannedExpenses.js";
import categoriesRouter from "./routes/categories.js";
import savingsRouter from "./routes/savings.js";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import goalsRouter from "./routes/goals.js";
import adminRouter from "./routes/admin.js";
import analyticsRouter from "./routes/analytics.js";
import transactionsParseV2Router from "./routes/v2/transactionsParse.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { handleDbError } from "./middleware/dbErrorHandler.js";

const app = express();

// Required when running behind reverse proxy (Nginx)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

if (config.rateLimit.enabled) {
  const baseLimiterOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
    // Use express-rate-limit helper to normalize IPv6 keys safely.
    keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket.remoteAddress || "127.0.0.1"),
  };

  const apiLimiter = rateLimit({
    ...baseLimiterOptions,
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  });

  const authLimiter = rateLimit({
    ...baseLimiterOptions,
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMax,
    message: { error: "Too many authentication attempts. Please try again later." },
  });

  const voiceLimiter = rateLimit({
    ...baseLimiterOptions,
    windowMs: config.rateLimit.voiceWindowMs,
    max: config.rateLimit.voiceMax,
    message: { error: "Voice parsing rate limit exceeded. Please try again later." },
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/v2/transactions/parse", voiceLimiter);
}

// Compression
app.use(compression());

// Body parser
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/planned-expenses", plannedExpensesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/savings", savingsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/v2/transactions", transactionsParseV2Router);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(handleDbError);
app.use(errorHandler);

export default app;
