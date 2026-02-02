import dotenv from "dotenv";

dotenv.config();

export default {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  // Access token — короткий срок, обновляется через refresh
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  // Refresh token — длинный срок, для обновления access без повторного входа
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || "30d",
};
