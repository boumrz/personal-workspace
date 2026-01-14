import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import config from "../config/config.js";

const router = express.Router();

// Register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email, passwordHash, name || null]
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
    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  })
);

// Login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const result = await pool.query("SELECT id, email, password_hash, name FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
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
    const result = await pool.query("SELECT id, email, name FROM users WHERE id = $1", [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
      },
    });
  })
);

export default router;
