import express from "express";
import { optionalAuthenticateToken } from "../middleware/optionalAuth.js";
import pool from "../database/db.js";

const router = express.Router();

/**
 * POST /api/analytics/event
 * Body: { event: string, platform: string, ...params }
 * Optional: Authorization header to attach user_id.
 * Used by mobile app (and optionally web) for analytics.
 */
router.post("/event", optionalAuthenticateToken, async (req, res, next) => {
  try {
    const { event, platform, ...payload } = req.body || {};
    if (!event || typeof event !== "string" || !platform || typeof platform !== "string") {
      return res.status(400).json({ error: "event and platform are required" });
    }
    const allowedPlatforms = ["web", "android", "ios"];
    if (!allowedPlatforms.includes(platform)) {
      return res.status(400).json({ error: "platform must be web, android, or ios" });
    }
    const userId = req.user ? req.user.userId : null;
    await pool.query(
      `INSERT INTO analytics_events (event, platform, user_id, payload) VALUES ($1, $2, $3, $4)`,
      [event.substring(0, 100), platform, userId, payload && Object.keys(payload).length ? payload : null]
    );
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
