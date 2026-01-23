import { authenticateToken } from "./auth.js";
import pool from "../database/db.js";

// Middleware для проверки прав администратора
// Доступ только у пользователя с login = "boumrz"
export const requireAdmin = async (req, res, next) => {
  // Сначала проверяем токен
  authenticateToken(req, res, async () => {
    try {
      // Получаем пользователя из базы данных
      const result = await pool.query(
        "SELECT id, login FROM users WHERE id = $1",
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = result.rows[0];

      // Проверяем, является ли пользователь администратором
      if (user.login !== "boumrz") {
        return res.status(403).json({ error: "Access denied. Admin rights required." });
      }

      // Пользователь является администратором, продолжаем
      next();
    } catch (error) {
      console.error("Admin auth error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
};
