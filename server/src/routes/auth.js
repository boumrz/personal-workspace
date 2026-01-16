import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { OAuth2Client } from "google-auth-library";
import pool from "../database/db.js";
import config from "../config/config.js";

const router = express.Router();

// Google OAuth client (опционально, только если настроены переменные окружения)
let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.CORS_ORIGIN || "http://localhost:3000"}/api/auth/google/callback`
  );
}

// Register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { fullName, login, password } = req.body;

    if (!fullName || !login || !password) {
      return res.status(400).json({ error: "Full name, login and password are required" });
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
        "INSERT INTO users (login, password_hash, name) VALUES ($1, $2, $3) RETURNING id, login, email, name",
        [login, passwordHash, fullName]
      );

      const user = result.rows[0];

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
          "INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4)",
          [user.id, category.name, category.color, category.icon]
        );
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, login: user.login }, config.jwtSecret, {
        expiresIn: "7d",
      });

      res.status(201).json({
        token,
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
    const { login, password } = req.body;

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

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, login: user.login }, config.jwtSecret, {
      expiresIn: "7d",
    });

    res.json({
      token,
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
            "INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4)",
            [user.id, category.name, category.color, category.icon]
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
