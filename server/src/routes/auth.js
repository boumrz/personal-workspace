import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import asyncHandler from "express-async-handler";
import { OAuth2Client } from "google-auth-library";
import pool from "../database/db.js";
import config from "../config/config.js";

const router = express.Router();
const VK_USER_INFO_TIMEOUT_MS = 10000;

/** platform: "web" | "android" | "ios" — откуда пришёл вход (опционально) */
async function updateLoginStats(userId, platform) {
  const now = new Date();
  const isMobile = platform === "android" || platform === "ios";
  const isWeb = platform === "web";

  if (isMobile) {
    await pool.query(
      `UPDATE users SET
        last_login_at = $1,
        first_login_at = COALESCE(first_login_at, $1),
        last_login_mobile_at = $1,
        first_login_mobile_at = COALESCE(first_login_mobile_at, $1),
        login_count = COALESCE(login_count, 0) + 1,
        login_count_mobile = COALESCE(login_count_mobile, 0) + 1
      WHERE id = $2`,
      [now, userId]
    );
  } else if (isWeb) {
    await pool.query(
      `UPDATE users SET
        last_login_at = $1,
        first_login_at = COALESCE(first_login_at, $1),
        last_login_web_at = $1,
        first_login_web_at = COALESCE(first_login_web_at, $1),
        login_count = COALESCE(login_count, 0) + 1,
        login_count_web = COALESCE(login_count_web, 0) + 1
      WHERE id = $2`,
      [now, userId]
    );
  } else {
    // platform не передан — обновляем только глобальные поля (обратная совместимость)
    await pool.query(
      `UPDATE users SET last_login_at = $1, first_login_at = COALESCE(first_login_at, $1),
       login_count = COALESCE(login_count, 0) + 1 WHERE id = $2`,
      [now, userId]
    );
  }
}

// Verify Telegram Login Widget data (HMAC-SHA256)
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

// Google OAuth client (опционально, только если настроены переменные окружения)
let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.CORS_ORIGIN || "http://localhost:3000"}/api/auth/google/callback`
  );
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

// Register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: "Login and password are required" });
    }

    // Validate login format
    if (!/^[a-zA-Z0-9_]+$/.test(login)) {
      return res.status(400).json({ error: "Login can only contain letters, numbers and underscores" });
    }

    if (login.length < 3) {
      return res.status(400).json({ error: "Login must be at least 3 characters" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
      // Check if user exists
      const existingUser = await pool.query("SELECT id FROM users WHERE login = $1", [login]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: "User with this login already exists" });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await pool.query(
        "INSERT INTO users (login, password_hash) VALUES ($1, $2) RETURNING id, login, email, name",
        [login, passwordHash]
      );

      const user = result.rows[0];

      // Create default categories for the user
      const defaultCategories = [
        { name: "Продукты", color: "#FF8A65", icon: "Utensils", type: "expense" },
        { name: "Транспорт", color: "#64B5F6", icon: "Car", type: "expense" },
        { name: "Развлечения", color: "#BA68C8", icon: "Film", type: "expense" },
        { name: "Здоровье", color: "#81C784", icon: "Hospital", type: "expense" },
        { name: "Одежда", color: "#FFB74D", icon: "Shirt", type: "expense" },
        { name: "Жилье", color: "#90CAF9", icon: "Home", type: "expense" },
        { name: "Зарплата", color: "#66BB6A", icon: "Wallet", type: "income" },
        { name: "Другое", color: "#90A4AE", icon: "Package", type: "both" },
      ];

      for (const category of defaultCategories) {
        await pool.query(
          "INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)",
          [user.id, category.name, category.color, category.icon, category.type]
        );
      }

      // Access + refresh tokens
      const token = jwt.sign(
        { userId: user.id, login: user.login, type: "access" },
        config.jwtSecret,
        { expiresIn: config.accessTokenExpiry }
      );
      const refreshToken = jwt.sign(
        { userId: user.id, type: "refresh" },
        config.jwtSecret,
        { expiresIn: config.refreshTokenExpiry }
      );

      res.status(201).json({
        token,
        refreshToken,
        user: {
          id: user.id,
          login: user.login,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      // Если это ошибка уникальности, вернем понятное сообщение
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ error: "User with this login already exists" });
      }
      // Для других ошибок вернем общее сообщение
      throw error; // Пробросим дальше для обработки в errorHandler
    }
  })
);

// Login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { login, password, platform } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: "Login and password are required" });
    }

    // Find user by login
    const result = await pool.query(
      "SELECT id, login, email, password_hash, name FROM users WHERE login = $1 AND password_hash IS NOT NULL",
      [login]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid login or password" });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid login or password" });
    }

    await updateLoginStats(user.id, platform);

    // Access + refresh tokens
    const token = jwt.sign(
      { userId: user.id, login: user.login, type: "access" },
      config.jwtSecret,
      { expiresIn: config.accessTokenExpiry }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.jwtSecret,
      { expiresIn: config.refreshTokenExpiry }
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
      },
    });
  })
);

// GET /api/auth/telegram/bot-id — возвращает bot_id для Telegram.Login.auth() (мобильный flow без iframe)
router.get(
  "/telegram/bot-id",
  asyncHandler(async (req, res) => {
    const botToken = config.telegramBotToken;
    if (!botToken) {
      return res.status(503).json({ error: "Telegram auth is not configured" });
    }
    const botId = botToken.split(":")[0];
    if (!botId) {
      return res.status(500).json({ error: "Invalid bot token format" });
    }
    res.json({ bot_id: botId });
  })
);

// Telegram Login Widget
router.post(
  "/telegram",
  asyncHandler(async (req, res) => {
    const botToken = config.telegramBotToken;
    if (!botToken) {
      return res.status(503).json({ error: "Telegram auth is not configured" });
    }

    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;

    if (!hash || !id) {
      return res.status(400).json({ error: "Invalid Telegram auth data" });
    }

    if (!verifyTelegramAuth(req.body, botToken)) {
      return res.status(401).json({ error: "Invalid Telegram signature" });
    }

    // Auth data must be fresh (within 24 hours)
    if (Date.now() / 1000 - auth_date > 86400) {
      return res.status(401).json({ error: "Telegram auth data expired" });
    }

    const telegramId = String(id);
    const name = [first_name, last_name].filter(Boolean).join(" ") || username || "User";
    const login = username ? `tg_${username}` : `tg_${id}`;

    let userResult = await pool.query(
      "SELECT id, login, email, name FROM users WHERE telegram_id = $1",
      [telegramId]
    );

    let user;
    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        "INSERT INTO users (telegram_id, login, name) VALUES ($1, $2, $3) RETURNING id, login, email, name",
        [telegramId, login, name]
      );
      user = insertResult.rows[0];

      const defaultCategories = [
        { name: "Продукты", color: "#FF8A65", icon: "Utensils", type: "expense" },
        { name: "Транспорт", color: "#64B5F6", icon: "Car", type: "expense" },
        { name: "Развлечения", color: "#BA68C8", icon: "Film", type: "expense" },
        { name: "Здоровье", color: "#81C784", icon: "Hospital", type: "expense" },
        { name: "Одежда", color: "#FFB74D", icon: "Shirt", type: "expense" },
        { name: "Жилье", color: "#90CAF9", icon: "Home", type: "expense" },
        { name: "Зарплата", color: "#66BB6A", icon: "Wallet", type: "income" },
        { name: "Другое", color: "#90A4AE", icon: "Package", type: "both" },
      ];
      for (const category of defaultCategories) {
        await pool.query(
          "INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)",
          [user.id, category.name, category.color, category.icon, category.type]
        );
      }
    } else {
      user = userResult.rows[0];
    }

    await updateLoginStats(user.id, req.body?.platform);

    const token = jwt.sign(
      { userId: user.id, login: user.login, type: "access" },
      config.jwtSecret,
      { expiresIn: config.accessTokenExpiry }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.jwtSecret,
      { expiresIn: config.refreshTokenExpiry }
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
      },
    });
  })
);

// VK ID — виджет (access_token от клиента, обмен через VKID.Auth.exchangeCode на фронте)
router.post(
  "/vkid",
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
    let usedAppId = null;
    let vkError = null;

    console.info("[auth/vkid] verifying VK token", {
      requestedAppId,
      appIdsTried: appIdsToTry,
    });

    for (const appId of appIdsToTry) {
      const result = await fetchVkUserInfo(appId, accessToken);
      if (result.user?.user_id) {
        vkUser = result.user;
        usedAppId = appId;
        break;
      }
      vkError = result.error;
    }

    if (!vkUser?.user_id) {
      console.warn("[auth/vkid] VK user_info failed", {
        requestedAppId,
        appIdsTried: appIdsToTry,
        details: vkError,
      });
      return res.status(401).json({ error: "Invalid or expired VK ID token" });
    }

    const vkId = String(vkUser.user_id);
    const name = [vkUser.first_name, vkUser.last_name].filter(Boolean).join(" ") || "User";
    const login = `vkid_${vkId}`;
    const email = vkUser.email || null;

    let userResult = await pool.query(
      "SELECT id, login, email, name FROM users WHERE vk_id = $1",
      [vkId]
    );

    let user;
    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        "INSERT INTO users (vk_id, login, name, email) VALUES ($1, $2, $3, $4) RETURNING id, login, email, name",
        [vkId, login, name, email]
      );
      user = insertResult.rows[0];

      const defaultCategories = [
        { name: "Продукты", color: "#FF8A65", icon: "Utensils", type: "expense" },
        { name: "Транспорт", color: "#64B5F6", icon: "Car", type: "expense" },
        { name: "Развлечения", color: "#BA68C8", icon: "Film", type: "expense" },
        { name: "Здоровье", color: "#81C784", icon: "Hospital", type: "expense" },
        { name: "Одежда", color: "#FFB74D", icon: "Shirt", type: "expense" },
        { name: "Жилье", color: "#90CAF9", icon: "Home", type: "expense" },
        { name: "Зарплата", color: "#66BB6A", icon: "Wallet", type: "income" },
        { name: "Другое", color: "#90A4AE", icon: "Package", type: "both" },
      ];
      for (const category of defaultCategories) {
        await pool.query(
          "INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)",
          [user.id, category.name, category.color, category.icon, category.type]
        );
      }
    } else {
      user = userResult.rows[0];
    }

    await updateLoginStats(user.id, req.body?.platform);

    const token = jwt.sign(
      { userId: user.id, login: user.login, type: "access" },
      config.jwtSecret,
      { expiresIn: config.accessTokenExpiry }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.jwtSecret,
      { expiresIn: config.refreshTokenExpiry }
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
      },
    });
  })
);

// Google OAuth - временно отключено
/*
// Google OAuth - initiate
router.get(
  "/google",
  asyncHandler(async (req, res) => {
    if (!googleClient) {
      // Если OAuth не настроен, возвращаем HTML страницу с ошибкой для popup
      return res.status(503).send(`
        <html>
          <head><title>OAuth Error</title></head>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: 'Google OAuth is not configured on the server' 
              }, '*');
              window.close();
            </script>
            <p>Google OAuth is not configured. Please contact administrator.</p>
          </body>
        </html>
      `);
    }
    const authUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: ["profile", "email"],
      prompt: "consent",
    });
    res.redirect(authUrl);
  })
);

// Google OAuth - callback
router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    if (!googleClient) {
      return res.status(503).send(`
        <script>
          window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'Google OAuth is not configured' }, '*');
          window.close();
        </script>
      `);
    }

    const { code } = req.query;

    if (!code) {
      return res.status(400).send(`
        <script>
          window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'Authorization code not provided' }, '*');
          window.close();
        </script>
      `);
    }

    try {
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      // Get user info from Google
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name;
      const picture = payload.picture;

      // Check if user exists
      let userResult = await pool.query(
        "SELECT id, login, email, name FROM users WHERE google_id = $1",
        [googleId]
      );

      let user;
      if (userResult.rows.length === 0) {
        // Create new user
        const insertResult = await pool.query(
          "INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING id, login, email, name",
          [googleId, email, name]
        );
        user = insertResult.rows[0];

        // Create default categories for the user
        const defaultCategories = [
          { name: "Продукты", color: "#FF8A65", icon: "Utensils" },
          { name: "Транспорт", color: "#64B5F6", icon: "Car" },
          { name: "Развлечения", color: "#BA68C8", icon: "Film" },
          { name: "Здоровье", color: "#81C784", icon: "Hospital" },
          { name: "Одежда", color: "#FFB74D", icon: "Shirt" },
          { name: "Жилье", color: "#90CAF9", icon: "Home" },
          { name: "Зарплата", color: "#66BB6A", icon: "Wallet" },
          { name: "Другое", color: "#90A4AE", icon: "Package" },
        ];

        for (const category of defaultCategories) {
          await pool.query(
            "INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)",
            [user.id, category.name, category.color, category.icon, category.type]
          );
        }
      } else {
        user = userResult.rows[0];
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, login: user.login, email: user.email }, config.jwtSecret, {
        expiresIn: "7d",
      });

      // Send message to popup window
      res.send(`
        <script>
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            token: '${token}',
            user: ${JSON.stringify({
              id: user.id,
              login: user.login,
              email: user.email,
              name: user.name,
            })}
          }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error("Google OAuth error:", error);
      res.status(500).send(`
        <script>
          window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'Authentication failed' }, '*');
          window.close();
        </script>
      `);
    }
  })
);
*/

// Refresh access token (body: { refreshToken } or Authorization: Bearer <refreshToken>)
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken =
      req.body?.refreshToken ||
      (req.headers["authorization"] && req.headers["authorization"].split(" ")[1]);

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwtSecret);
    } catch {
      return res.status(403).json({ error: "Invalid or expired refresh token" });
    }

    if (decoded.type !== "refresh") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    const result = await pool.query(
      "SELECT id, login, email, name FROM users WHERE id = $1",
      [decoded.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    const newAccessToken = jwt.sign(
      { userId: user.id, login: user.login },
      config.jwtSecret,
      { expiresIn: config.accessTokenExpiry }
    );
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.jwtSecret,
      { expiresIn: config.refreshTokenExpiry }
    );

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        name: user.name,
      },
    });
  })
);

// Get current user
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const result = await pool.query("SELECT id, login, email, name FROM users WHERE id = $1", [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: result.rows[0].id,
        login: result.rows[0].login,
        email: result.rows[0].email,
        name: result.rows[0].name,
      },
    });
  })
);

export default router;
