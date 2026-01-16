import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Очищаем имя базы данных от лишних символов
const dbName = (process.env.DB_NAME || "finance_assistant").trim().replace(/[;,\s]+$/, "");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: dbName,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

// Test connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export default pool;
