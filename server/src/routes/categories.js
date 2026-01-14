import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all categories
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const result = await pool.query("SELECT * FROM categories WHERE user_id = $1 ORDER BY id", [userId]);

    const categories = result.rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      color: row.color,
      icon: row.icon,
    }));

    res.json(categories);
  })
);

// Create category
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, color, icon } = req.body;
    const userId = req.user.userId;

    if (!name || !color || !icon) {
      return res.status(400).json({ error: "Missing required fields: name, color, icon" });
    }

    const result = await pool.query(
      `INSERT INTO categories (user_id, name, color, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, color, icon`,
      [userId, name, color, icon]
    );

    const row = result.rows[0];
    const category = {
      id: row.id.toString(),
      name: row.name,
      color: row.color,
      icon: row.icon,
    };

    res.status(201).json(category);
  })
);

// Get category by ID
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = await pool.query("SELECT * FROM categories WHERE id = $1 AND user_id = $2", [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const row = result.rows[0];
    const category = {
      id: row.id.toString(),
      name: row.name,
      color: row.color,
      icon: row.icon,
    };

    res.json(category);
  })
);

// Delete category
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);
    const userId = req.user.userId;

    // Проверяем, что ID валидный
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    // Сначала проверяем, существует ли категория
    const categoryCheck = await pool.query(
      "SELECT id, name FROM categories WHERE id = $1 AND user_id = $2",
      [categoryId, userId]
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryName = categoryCheck.rows[0].name;

    // Проверяем, используется ли категория в транзакциях или планируемых расходах
    const transactionsCheck = await pool.query(
      "SELECT COUNT(*)::int as count FROM transactions WHERE category_id = $1",
      [categoryId]
    );
    const plannedCheck = await pool.query(
      "SELECT COUNT(*)::int as count FROM planned_expenses WHERE category_id = $1",
      [categoryId]
    );

    const transactionCount = transactionsCheck.rows[0].count;
    const plannedCount = plannedCheck.rows[0].count;

    if (transactionCount > 0 || plannedCount > 0) {
      return res.status(400).json({
        error: `Невозможно удалить категорию "${categoryName}", так как она используется в ${transactionCount} транзакциях и ${plannedCount} планируемых расходах`,
      });
    }

    // Удаляем категорию
    const result = await pool.query("DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id", [
      categoryId,
      userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  })
);

export default router;
