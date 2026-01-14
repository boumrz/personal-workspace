import dotenv from "dotenv";

dotenv.config();

export default {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  corsOrigin: process.env.CORS_ORIGIN || "*",
};
