import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import config from "./config/config.js";
import transactionsRouter from "./routes/transactions.js";
import plannedExpensesRouter from "./routes/plannedExpenses.js";
import categoriesRouter from "./routes/categories.js";
import savingsRouter from "./routes/savings.js";
import authRouter from "./routes/auth.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { handleDbError } from "./middleware/dbErrorHandler.js";

const app = express();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api/", limiter);

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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(handleDbError);
app.use(errorHandler);

export default app;
