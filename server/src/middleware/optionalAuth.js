import jwt from "jsonwebtoken";
import config from "../config/config.js";

/**
 * Optional auth: if Authorization header is present and valid, sets req.user.
 * Does not return 401/403 if token is missing or invalid (for public endpoints like analytics).
 */
export const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};
