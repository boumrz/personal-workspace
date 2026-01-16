import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all savings
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT *
      FROM savings
      WHERE user_id = $1
      ORDER BY date DESC, created_at DESC
    `,
      [userId]
    );

    const savings = result.rows.map((row) => ({
      id: row.id.toString(),
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
    }));

    res.json(savings);
  })
);

// Get savings by ID
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT *
      FROM savings
      WHERE id = $1 AND user_id = $2
    `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Savings not found" });
    }

    const row = result.rows[0];
    const saving = {
      id: row.id.toString(),
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
    };

    res.json(saving);
  })
);

// Create savings
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { amount, description, date } = req.body;
    const userId = req.user.userId;

    if (!amount || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO savings (user_id, amount, description, date)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
      [userId, amount, description || null, date]
    );

    const savingsId = result.rows[0].id;

    // Fetch the created savings
    const savingsResult = await pool.query(
      `
      SELECT *
      FROM savings
      WHERE id = $1
    `,
      [savingsId]
    );

    const row = savingsResult.rows[0];
    const saving = {
      id: row.id.toString(),
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
    };

    res.status(201).json(saving);
  })
);

// Update savings
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, description, date } = req.body;
    const userId = req.user.userId;

    if (!amount || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      `
      UPDATE savings
      SET amount = $1, description = $2, date = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
    `,
      [amount, description || null, date, id, userId]
    );

    // Fetch updated savings
    const result = await pool.query(
      `
      SELECT *
      FROM savings
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Savings not found" });
    }

    const row = result.rows[0];
    const saving = {
      id: row.id.toString(),
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
    };

    res.json(saving);
  })
);

// Delete savings
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query("DELETE FROM savings WHERE id = $1 AND user_id = $2 RETURNING id", [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Savings not found" });
    }

    res.json({ message: "Savings deleted successfully" });
  })
);

export default router;
