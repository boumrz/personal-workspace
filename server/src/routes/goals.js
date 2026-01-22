import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all goals for current user
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT *
      FROM goals
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
      [userId]
    );

    const goals = result.rows.map((row) => ({
      id: row.id.toString(),
      title: row.title,
      targetAmount: parseFloat(row.target_amount),
      currentAmount: parseFloat(row.current_amount),
      description: row.description || "",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    res.json(goals);
  })
);

// Get goal by ID
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT *
      FROM goals
      WHERE id = $1 AND user_id = $2
    `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const row = result.rows[0];
    const goal = {
      id: row.id.toString(),
      title: row.title,
      targetAmount: parseFloat(row.target_amount),
      currentAmount: parseFloat(row.current_amount),
      description: row.description || "",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };

    res.json(goal);
  })
);

// Create goal
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, targetAmount, description } = req.body;
    const userId = req.user.userId;

    if (!title || targetAmount === undefined) {
      return res.status(400).json({ error: "Title and target amount are required" });
    }

    const targetAmountNum = parseFloat(targetAmount);
    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      return res.status(400).json({ error: "Invalid target amount" });
    }

    const result = await pool.query(
      `
      INSERT INTO goals (user_id, title, target_amount, current_amount, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
      [userId, title, targetAmountNum, 0, description || null]
    );

    const goalId = result.rows[0].id;

    // Fetch the created goal
    const goalResult = await pool.query(
      `
      SELECT *
      FROM goals
      WHERE id = $1
    `,
      [goalId]
    );

    const row = goalResult.rows[0];
    const goal = {
      id: row.id.toString(),
      title: row.title,
      targetAmount: parseFloat(row.target_amount),
      currentAmount: parseFloat(row.current_amount),
      description: row.description || "",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };

    res.status(201).json(goal);
  })
);

// Update goal
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, targetAmount, currentAmount, description } = req.body;
    const userId = req.user.userId;

    // Check if goal exists and belongs to user
    const checkResult = await pool.query(
      "SELECT id FROM goals WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }

    if (targetAmount !== undefined) {
      const targetAmountNum = parseFloat(targetAmount);
      if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
        return res.status(400).json({ error: "Invalid target amount" });
      }
      updates.push(`target_amount = $${paramCount++}`);
      values.push(targetAmountNum);
    }

    if (currentAmount !== undefined) {
      const currentAmountNum = parseFloat(currentAmount);
      if (isNaN(currentAmountNum) || currentAmountNum < 0) {
        return res.status(400).json({ error: "Invalid current amount" });
      }
      updates.push(`current_amount = $${paramCount++}`);
      values.push(currentAmountNum);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Always update updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id, userId);
    const query = `
      UPDATE goals 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const row = result.rows[0];
    const goal = {
      id: row.id.toString(),
      title: row.title,
      targetAmount: parseFloat(row.target_amount),
      currentAmount: parseFloat(row.current_amount),
      description: row.description || "",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };

    res.json(goal);
  })
);

// Delete goal
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query(
      "DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  })
);

export default router;
