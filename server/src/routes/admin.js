import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import bcrypt from "bcrypt";
import config from "../config/config.js";

const router = express.Router();

const ALL_LLM_PROVIDERS = [
  { id: "gigachat", label: "GigaChat", model: "GigaChat" },
  { id: "gpt4free", label: "GPT4Free", model: "gpt-4o-mini" },
  { id: "gemini", label: "Gemini", model: "gemini-2.0-flash" },
  { id: "gemini-flash-lite", label: "Gemini Flash Lite", model: "gemini-2.0-flash-lite" },
  { id: "openrouter", label: "OpenRouter", model: "various" },
  { id: "groq", label: "Groq", model: "llama-3.1-8b-instant" },
  { id: "heuristic", label: "Эвристика (fallback)", model: null },
];

// Все роуты требуют прав администратора
router.use(requireAdmin);

// GET /api/admin/users - получить список всех пользователей
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const result = await pool.query(`
      SELECT 
        id,
        login,
        email,
        name,
        last_name,
        first_name,
        middle_name,
        age,
        date_of_birth,
        created_at,
        first_login_at,
        last_login_at,
        last_login_web_at,
        last_login_mobile_at,
        login_count,
        login_count_web,
        login_count_mobile,
        voice_llm_provider,
        voice_llm_provider_chain,
        voice_llm_enabled_providers,
        google_id
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({ users: result.rows });
  })
);

// PUT /api/admin/users/:id - обновить пользователя
router.put(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      login,
      email,
      name,
      last_name,
      first_name,
      middle_name,
      age,
      date_of_birth,
      password,
    } = req.body;

    // Проверяем, существует ли пользователь
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Собираем поля для обновления
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (login !== undefined) {
      // Проверяем уникальность login
      const loginCheck = await pool.query(
        "SELECT id FROM users WHERE login = $1 AND id != $2",
        [login, id]
      );
      if (loginCheck.rows.length > 0) {
        return res.status(400).json({ error: "User with this login already exists" });
      }
      updates.push(`login = $${paramIndex++}`);
      values.push(login);
    }

    if (email !== undefined) {
      // Проверяем уникальность email
      if (email) {
        const emailCheck = await pool.query(
          "SELECT id FROM users WHERE email = $1 AND id != $2",
          [email, id]
        );
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: "User with this email already exists" });
        }
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(last_name);
    }

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(first_name);
    }

    if (middle_name !== undefined) {
      updates.push(`middle_name = $${paramIndex++}`);
      values.push(middle_name);
    }

    if (age !== undefined) {
      updates.push(`age = $${paramIndex++}`);
      values.push(age);
    }

    if (date_of_birth !== undefined) {
      updates.push(`date_of_birth = $${paramIndex++}`);
      values.push(date_of_birth);
    }

    if (password !== undefined && password !== "") {
      // Хешируем новый пароль
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Добавляем id в конец для WHERE условия
    values.push(id);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, login, email, name, last_name, first_name, middle_name, age, date_of_birth, created_at, last_login_at, login_count`;

    const result = await pool.query(query, values);
    res.json({ user: result.rows[0] });
  })
);

// GET /api/admin/llm-providers — все провайдеры для админа (включая gigachat и др., выключенные по умолчанию)
router.get(
  "/llm-providers",
  asyncHandler(async (req, res) => {
    res.json({ providers: ALL_LLM_PROVIDERS });
  })
);

// PUT /api/admin/users/:id/llm — обновить LLM настройки пользователя
router.put(
  "/users/:id/llm",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { voice_llm_provider_chain, voice_llm_enabled_providers } = req.body;

    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (voice_llm_provider_chain !== undefined) {
      const chain =
        Array.isArray(voice_llm_provider_chain)
          ? voice_llm_provider_chain
          : typeof voice_llm_provider_chain === "string"
            ? voice_llm_provider_chain.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
      updates.push(`voice_llm_provider_chain = $${paramIndex++}`);
      values.push(chain.length ? chain.join(",") : null);
    }

    if (voice_llm_enabled_providers !== undefined) {
      const list =
        Array.isArray(voice_llm_enabled_providers)
          ? voice_llm_enabled_providers
          : typeof voice_llm_enabled_providers === "string"
            ? voice_llm_enabled_providers.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
      updates.push(`voice_llm_enabled_providers = $${paramIndex++}`);
      values.push(list.length ? list.join(",") : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No LLM fields to update" });
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}
      RETURNING id, voice_llm_provider, voice_llm_provider_chain, voice_llm_enabled_providers`;
    const result = await pool.query(query, values);
    res.json({ user: result.rows[0] });
  })
);

// DELETE /api/admin/users/:id - удалить пользователя
router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    // Проверяем, существует ли пользователь
    const userCheck = await pool.query("SELECT id, login FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Не позволяем удалить самого себя
    if (Number(id) === currentUserId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Не позволяем удалить главного администратора
    if (userCheck.rows[0].login === "boumrz") {
      return res.status(400).json({ error: "Cannot delete admin user" });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ message: "User deleted successfully" });
  })
);

export default router;
