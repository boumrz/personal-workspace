import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import config from "../config/config.js";
import { authenticateToken } from "../middleware/auth.js";

const saltRounds = 10;

const router = express.Router();
const VK_USER_INFO_TIMEOUT_MS = 10000;

function verifyTelegramAuth(authData, botToken) {
  const { hash, ...data } = authData;
  if (!hash || !botToken) return false;
  const dataCheckString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  return calculatedHash === hash;
}

function countAuthMethods(user) {
  let count = 0;
  if (user.password_hash) count++;
  if (user.google_id) count++;
  if (user.telegram_id) count++;
  if (user.vk_id) count++;
  return count;
}

async function fetchVkUserInfo(appId, accessToken) {
  const endpoints = [
    "https://id.vk.ru/oauth2/user_info",
    "https://id.vk.com/oauth2/user_info",
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VK_USER_INFO_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
        body: new URLSearchParams({
          client_id: appId,
          access_token: accessToken,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (payload?.user?.user_id) {
        return { user: payload.user, endpoint, error: null };
      }

      const providerError =
        payload?.error_description ||
        payload?.error ||
        payload?.description ||
        `HTTP ${response.status}`;
      lastError = `${endpoint}: ${providerError}`;
    } catch (error) {
      lastError =
        error?.name === "AbortError"
          ? `${endpoint}: timeout after ${VK_USER_INFO_TIMEOUT_MS}ms`
          : `${endpoint}: ${error.message || "network error"}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { user: null, endpoint: null, error: lastError };
}

// All routes require authentication
router.use(authenticateToken);

// Get current user profile
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT id, login, email, name, last_name, first_name, middle_name, age, date_of_birth, telegram_id, vk_id,
        voice_llm_provider, voice_llm_provider_chain,
        (password_hash IS NOT NULL) AS has_password,
        (CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN google_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN telegram_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN vk_id IS NOT NULL THEN 1 ELSE 0 END) AS auth_methods_count
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      login: user.login,
      email: user.email,
      name: user.name,
      lastName: user.last_name,
      firstName: user.first_name,
      middleName: user.middle_name,
      age: user.age,
      dateOfBirth: user.date_of_birth ? user.date_of_birth.toISOString().split('T')[0] : null,
      telegramId: user.telegram_id || null,
      vkId: user.vk_id || null,
      voiceLlmProvider: user.voice_llm_provider || null,
      voiceLlmProviderChain: user.voice_llm_provider_chain
        ? user.voice_llm_provider_chain.split(",").map((p) => p.trim()).filter(Boolean)
        : null,
      hasPassword: user.has_password,
      authMethodsCount: parseInt(user.auth_methods_count, 10),
    });
  })
);

// Update user profile
router.put(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { lastName, firstName, middleName, age, dateOfBirth } = req.body;

    // Validate age if provided
    if (age !== undefined && age !== null) {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        return res.status(400).json({ error: "Invalid age" });
      }
    }

    // Validate dateOfBirth if provided
    if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== "") {
      const date = new Date(dateOfBirth);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: "Invalid date of birth" });
      }
    }

    // Update only provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName || null);
    }

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName || null);
    }

    if (middleName !== undefined) {
      updates.push(`middle_name = $${paramCount++}`);
      values.push(middleName || null);
    }

    if (age !== undefined) {
      updates.push(`age = $${paramCount++}`);
      values.push(age !== null && age !== "" ? parseInt(age) : null);
    }

    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount++}`);
      values.push(dateOfBirth && dateOfBirth !== "" ? dateOfBirth : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, login, email, name, last_name, first_name, middle_name, age, date_of_birth, telegram_id, vk_id, voice_llm_provider, voice_llm_provider_chain
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      login: user.login,
      email: user.email,
      name: user.name,
      lastName: user.last_name,
      firstName: user.first_name,
      middleName: user.middle_name,
      age: user.age,
      dateOfBirth: user.date_of_birth ? user.date_of_birth.toISOString().split('T')[0] : null,
      telegramId: user.telegram_id || null,
      voiceLlmProvider: user.voice_llm_provider || null,
      voiceLlmProviderChain: user.voice_llm_provider_chain
        ? user.voice_llm_provider_chain.split(",").map((p) => p.trim()).filter(Boolean)
        : null,
      vkId: user.vk_id || null,
    });
  })
);

// Link Telegram to current account
router.post(
  "/link/telegram",
  asyncHandler(async (req, res) => {
    const botToken = config.telegramBotToken;
    if (!botToken) {
      return res.status(503).json({ error: "Telegram auth is not configured" });
    }

    const { id, first_name, last_name, username, auth_date, hash } = req.body;
    if (!hash || !id) {
      return res.status(400).json({ error: "Invalid Telegram auth data" });
    }

    if (!verifyTelegramAuth(req.body, botToken)) {
      return res.status(401).json({ error: "Invalid Telegram signature" });
    }

    if (Date.now() / 1000 - auth_date > 86400) {
      return res.status(401).json({ error: "Telegram auth data expired" });
    }

    const telegramId = String(id);
    const userId = req.user.userId;

    const existingByTg = await pool.query(
      "SELECT id FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    if (existingByTg.rows.length > 0 && existingByTg.rows[0].id !== userId) {
      return res.status(400).json({ error: "This Telegram account is already linked to another user" });
    }

    await pool.query(
      "UPDATE users SET telegram_id = $1 WHERE id = $2",
      [telegramId, userId]
    );

    res.json({ success: true, message: "Telegram linked successfully" });
  })
);

// Set password (for users who signed up via social login only)
router.post(
  "/set-password",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { password } = req.body;
    const newLoginRaw = req.body?.login;
    const newLogin = typeof newLoginRaw === "string" ? newLoginRaw.trim() : "";

    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!newLogin) {
      return res.status(400).json({ error: "Login is required" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newLogin)) {
      return res.status(400).json({ error: "Login can only contain letters, numbers and underscores" });
    }
    if (newLogin.length < 3) {
      return res.status(400).json({ error: "Login must be at least 3 characters" });
    }

    const userResult = await pool.query(
      "SELECT password_hash, login FROM users WHERE id = $1",
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    if (user.password_hash) {
      return res.status(400).json({ error: "Password already set. Use change-password to update it." });
    }
    const existingLoginResult = await pool.query(
      "SELECT id FROM users WHERE login = $1 AND id <> $2",
      [newLogin, userId]
    );
    if (existingLoginResult.rows.length > 0) {
      return res.status(400).json({ error: "User with this login already exists" });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    await pool.query(
      "UPDATE users SET password_hash = $1, login = $2 WHERE id = $3",
      [passwordHash, newLogin, userId]
    );

    res.json({ success: true, message: "Password set successfully" });
  })
);

// Unlink Telegram from current account
router.post(
  "/unlink/telegram",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const userResult = await pool.query(
      "SELECT password_hash, google_id, telegram_id, vk_id FROM users WHERE id = $1",
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    if (!user.telegram_id) {
      return res.status(400).json({ error: "Telegram is not linked to this account" });
    }

    const count = countAuthMethods(user);
    if (count <= 1) {
      return res.status(400).json({
        error: "Cannot unlink the only sign-in method. Add password or another social account first.",
      });
    }

    await pool.query(
      "UPDATE users SET telegram_id = NULL WHERE id = $1",
      [userId]
    );

    res.json({ success: true, message: "Telegram unlinked successfully" });
  })
);

// Link VK ID to current account
router.post(
  "/link/vkid",
  asyncHandler(async (req, res) => {
    const requestedAppId = req.body?.app_id ? String(req.body.app_id) : null;
    const configuredAppIds = Array.isArray(config.vkId?.appIds)
      ? config.vkId.appIds
      : [config.vkId?.appId].filter(Boolean);

    if (configuredAppIds.length === 0) {
      return res.status(503).json({ error: "VK ID is not configured" });
    }

    if (requestedAppId && !configuredAppIds.includes(requestedAppId)) {
      return res.status(400).json({ error: "Unsupported VK app_id" });
    }

    const appIdsToTry = requestedAppId ? [requestedAppId] : configuredAppIds;
    if (appIdsToTry.length === 0) {
      if (req.body?.app_id) {
        return res.status(400).json({ error: "Unsupported VK app_id" });
      }
      return res.status(503).json({ error: "VK ID is not configured" });
    }

    const accessToken = String(req.body?.access_token || "").trim();
    if (!accessToken) {
      return res.status(400).json({ error: "access_token required" });
    }

    let vkUser = null;
    let vkError = null;

    console.info("[profile/link/vkid] verifying VK token", {
      requestedAppId,
      appIdsTried: appIdsToTry,
    });

    for (const appId of appIdsToTry) {
      const result = await fetchVkUserInfo(appId, accessToken);
      if (result.user?.user_id) {
        vkUser = result.user;
        break;
      }
      vkError = result.error;
    }

    if (!vkUser?.user_id) {
      console.warn("[profile/link/vkid] VK user_info failed", {
        requestedAppId,
        appIdsTried: appIdsToTry,
        details: vkError,
      });
      return res.status(401).json({ error: "Invalid or expired VK ID token" });
    }

    const vkId = String(vkUser.user_id);
    const userId = req.user.userId;

    const existingByVk = await pool.query(
      "SELECT id FROM users WHERE vk_id = $1",
      [vkId]
    );
    if (existingByVk.rows.length > 0 && existingByVk.rows[0].id !== userId) {
      return res.status(400).json({ error: "This VK account is already linked to another user" });
    }

    await pool.query(
      "UPDATE users SET vk_id = $1 WHERE id = $2",
      [vkId, userId]
    );

    res.json({ success: true, message: "VK linked successfully" });
  })
);

// Unlink VK from current account
router.post(
  "/unlink/vk",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const userResult = await pool.query(
      "SELECT password_hash, google_id, telegram_id, vk_id FROM users WHERE id = $1",
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    if (!user.vk_id) {
      return res.status(400).json({ error: "VK is not linked to this account" });
    }

    const count = countAuthMethods(user);
    if (count <= 1) {
      return res.status(400).json({
        error: "Cannot unlink the only sign-in method. Add password or another social account first.",
      });
    }

    await pool.query(
      "UPDATE users SET vk_id = NULL WHERE id = $1",
      [userId]
    );

    res.json({ success: true, message: "VK unlinked successfully" });
  })
);

export default router;
