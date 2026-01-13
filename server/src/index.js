import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transactionsRouter from "./routes/transactions.js";
import plannedExpensesRouter from "./routes/plannedExpenses.js";
import categoriesRouter from "./routes/categories.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/planned-expenses", plannedExpensesRouter);
app.use("/api/categories", categoriesRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
