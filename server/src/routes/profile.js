import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../database/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get current user profile
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const result = await pool.query(
      "SELECT id, login, email, name, last_name, first_name, middle_name, age, date_of_birth FROM users WHERE id = $1",
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
      RETURNING id, login, email, name, last_name, first_name, middle_name, age, date_of_birth
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
    });
  })
);

export default router;
