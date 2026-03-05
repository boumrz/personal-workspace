import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../../database/db.js";
import { authenticateToken } from "../../middleware/auth.js";
import { parseTransactionsFromSpeech } from "../../services/transactionSpeechParser.js";

const router = express.Router();

router.use(authenticateToken);

router.post(
  "/parse",
  asyncHandler(async (req, res) => {
    const { text, mode = "actual", context } = req.body ?? {};
    const userId = req.user.userId;
    const normalizedText = typeof text === "string" ? text.trim() : "";

    if (!normalizedText) {
      return res.status(400).json({ error: "Field 'text' is required" });
    }

    if (mode !== "actual" && mode !== "planned") {
      return res.status(400).json({ error: "Field 'mode' must be 'actual' or 'planned'" });
    }

    const categoriesResult = await pool.query(
      "SELECT id, name, color, icon FROM categories WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );

    const categories = categoriesResult.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      color: row.color,
      icon: row.icon,
    }));

    const parsed = await parseTransactionsFromSpeech({
      text: normalizedText,
      mode,
      categories,
      timezone: context?.timezone,
    });

    res.json({
      items: parsed.items,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
      unparsedText: parsed.unparsedText,
    });
  })
);

export default router;
