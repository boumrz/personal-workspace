import express from "express";
import pool from "../database/db.js";

const router = express.Router();

// Get all categories
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories ORDER BY id");

    const categories = result.rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      color: row.color,
      icon: row.icon,
    }));

    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create category
router.post("/", async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !color || !icon) {
      return res.status(400).json({ error: "Missing required fields: name, color, icon" });
    }

    const result = await pool.query(
      `INSERT INTO categories (name, color, icon)
       VALUES ($1, $2, $3)
       RETURNING id, name, color, icon`,
      [name, color, icon]
    );

    const row = result.rows[0];
    const category = {
      id: row.id.toString(),
      name: row.name,
      color: row.color,
      icon: row.icon,
    };

    res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    // Check if it's a unique constraint violation
    if (error.code === "23505") {
      return res.status(409).json({ error: "Category with this name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get category by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);

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
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete category
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id, 10);
    
    // Проверяем, что ID валидный
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    // Сначала проверяем, существует ли категория
    const categoryCheck = await pool.query(
      "SELECT id, name FROM categories WHERE id = $1",
      [categoryId]
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
        error: `Невозможно удалить категорию "${categoryName}", так как она используется в ${transactionCount} транзакциях и ${plannedCount} планируемых расходах` 
      });
    }

    // Удаляем категорию
    const result = await pool.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [categoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
