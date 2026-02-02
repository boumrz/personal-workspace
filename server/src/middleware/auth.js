import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    // Не принимаем refresh-токен в заголовке для защищённых маршрутов
    if (decoded.type === "refresh") {
      return res.status(403).json({ error: "Access token required" });
    }
    req.user = decoded;
    next();
  });
};
