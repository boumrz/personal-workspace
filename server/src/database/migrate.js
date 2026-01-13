import pool from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log("Starting database migration...");

    // Create tables
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(7) NOT NULL,
        icon VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS planned_expenses (
        id SERIAL PRIMARY KEY,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_planned_expenses_date ON planned_expenses(date);
      CREATE INDEX IF NOT EXISTS idx_planned_expenses_category ON planned_expenses(category_id);
    `;

    await pool.query(createTablesQuery);
    console.log("Tables created successfully");

    // Insert default categories
    const categoriesQuery = `
      INSERT INTO categories (name, color, icon)
      VALUES
        ('Продукты', '#FF8A65', 'Utensils'),
        ('Транспорт', '#64B5F6', 'Car'),
        ('Развлечения', '#BA68C8', 'Film'),
        ('Здоровье', '#81C784', 'Hospital'),
        ('Одежда', '#FFB74D', 'Shirt'),
        ('Жилье', '#90CAF9', 'Home'),
        ('Зарплата', '#66BB6A', 'Wallet'),
        ('Другое', '#90A4AE', 'Package')
      ON CONFLICT (name) DO NOTHING;
    `;

    await pool.query(categoriesQuery);
    console.log("Default categories inserted");

    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
