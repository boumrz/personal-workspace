import express from "express";
import pool from "../database/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all transactions
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(`
      SELECT 
        t.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
      ORDER BY t.date DESC, t.created_at DESC
    `, [userId]);

    const transactions = result.rows.map((row) => ({
      id: row.id.toString(),
      type: row.type,
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
      category: {
        id: row.category_id.toString(),
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
      },
    }));

    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get transaction by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT 
        t.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1 AND t.user_id = $2
    `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const row = result.rows[0];
    const transaction = {
      id: row.id.toString(),
      type: row.type,
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
      category: {
        id: row.category_id.toString(),
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
      },
    };

    res.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create transaction
router.post("/", async (req, res) => {
  try {
    const { type, amount, description, date, category } = req.body;
    const userId = req.user.userId;

    if (!type || !amount || !date || !category?.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify category belongs to user
    const categoryCheck = await pool.query(
      "SELECT id FROM categories WHERE id = $1 AND user_id = $2",
      [category.id, userId]
    );
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const result = await pool.query(
      `
      INSERT INTO transactions (user_id, type, amount, description, date, category_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [userId, type, amount, description || null, date, category.id]
    );

    const transactionId = result.rows[0].id;

    // Fetch the created transaction with category
    const transactionResult = await pool.query(
      `
      SELECT 
        t.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1
    `,
      [transactionId]
    );

    const row = transactionResult.rows[0];
    const transaction = {
      id: row.id.toString(),
      type: row.type,
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
      category: {
        id: row.category_id.toString(),
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
      },
    };

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update transaction
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, date, category } = req.body;
    const userId = req.user.userId;

    if (!type || !amount || !date || !category?.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify category belongs to user
    const categoryCheck = await pool.query(
      "SELECT id FROM categories WHERE id = $1 AND user_id = $2",
      [category.id, userId]
    );
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    await pool.query(
      `
      UPDATE transactions
      SET type = $1, amount = $2, description = $3, date = $4, category_id = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
    `,
      [type, amount, description || null, date, category.id, id, userId]
    );

    // Fetch updated transaction
    const result = await pool.query(
      `
      SELECT 
        t.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const row = result.rows[0];
    const transaction = {
      id: row.id.toString(),
      type: row.type,
      amount: parseFloat(row.amount),
      description: row.description || "",
      date: row.date.toISOString().split("T")[0],
      category: {
        id: row.category_id.toString(),
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
      },
    };

    res.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete transaction
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query("DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
