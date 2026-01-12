import express from "express";
import pool from "../database/db.js";

const router = express.Router();

// Get all planned expenses
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pe.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM planned_expenses pe
      JOIN categories c ON pe.category_id = c.id
      ORDER BY pe.date ASC, pe.created_at DESC
    `);

    const expenses = result.rows.map((row) => ({
      id: row.id.toString(),
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

    res.json(expenses);
  } catch (error) {
    console.error("Error fetching planned expenses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get planned expense by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT 
        pe.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM planned_expenses pe
      JOIN categories c ON pe.category_id = c.id
      WHERE pe.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Planned expense not found" });
    }

    const row = result.rows[0];
    const expense = {
      id: row.id.toString(),
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

    res.json(expense);
  } catch (error) {
    console.error("Error fetching planned expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create planned expense
router.post("/", async (req, res) => {
  try {
    const { amount, description, date, category } = req.body;

    if (!amount || !date || !category?.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO planned_expenses (amount, description, date, category_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
      [amount, description || null, date, category.id]
    );

    const expenseId = result.rows[0].id;

    // Fetch the created expense with category
    const expenseResult = await pool.query(
      `
      SELECT 
        pe.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM planned_expenses pe
      JOIN categories c ON pe.category_id = c.id
      WHERE pe.id = $1
    `,
      [expenseId]
    );

    const row = expenseResult.rows[0];
    const expense = {
      id: row.id.toString(),
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

    res.status(201).json(expense);
  } catch (error) {
    console.error("Error creating planned expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update planned expense
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, category } = req.body;

    if (!amount || !date || !category?.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await pool.query(
      `
      UPDATE planned_expenses
      SET amount = $1, description = $2, date = $3, category_id = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `,
      [amount, description || null, date, category.id, id]
    );

    // Fetch updated expense
    const result = await pool.query(
      `
      SELECT 
        pe.*,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM planned_expenses pe
      JOIN categories c ON pe.category_id = c.id
      WHERE pe.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Planned expense not found" });
    }

    const row = result.rows[0];
    const expense = {
      id: row.id.toString(),
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

    res.json(expense);
  } catch (error) {
    console.error("Error updating planned expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete planned expense
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM planned_expenses WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Planned expense not found" });
    }

    res.json({ message: "Planned expense deleted successfully" });
  } catch (error) {
    console.error("Error deleting planned expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
