import pool from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log("Starting database migration...");

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Users table created/verified");

    // Check if categories table exists and has user_id column
    const categoriesCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories' AND column_name = 'user_id'
    `);

    if (categoriesCheck.rows.length === 0) {
      // Table exists but doesn't have user_id - need to migrate
      console.log("Migrating categories table...");
      
      // First, drop the unique constraint on name if it exists
      try {
        await pool.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key`);
      } catch (e) {
        // Ignore if constraint doesn't exist
      }

      // Add user_id column (nullable for now)
      await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id INTEGER`);
      
      // Create a default user for existing data
      const defaultUserResult = await pool.query(`
        INSERT INTO users (email, password_hash, name) 
        VALUES ('migrated@example.com', '$2b$10$dummy', 'Migrated User')
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `);
      
      let defaultUserId;
      if (defaultUserResult.rows.length > 0) {
        defaultUserId = defaultUserResult.rows[0].id;
      } else {
        const existingUser = await pool.query(`SELECT id FROM users WHERE email = 'migrated@example.com'`);
        defaultUserId = existingUser.rows[0].id;
      }

      // Update existing categories with default user_id
      await pool.query(`UPDATE categories SET user_id = $1 WHERE user_id IS NULL`, [defaultUserId]);
      
      // Make user_id NOT NULL and add foreign key
      await pool.query(`ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL`);
      await pool.query(`ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
      
      // Add unique constraint on (user_id, name)
      await pool.query(`ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name)`);
    } else {
      // Table might not exist at all, create it
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(7) NOT NULL,
          icon VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        );
      `);
    }
    console.log("Categories table created/verified");

    // Check and migrate transactions table
    const transactionsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'user_id'
    `);

    if (transactionsCheck.rows.length === 0) {
      console.log("Migrating transactions table...");
      
      // Get default user id
      const defaultUser = await pool.query(`SELECT id FROM users WHERE email = 'migrated@example.com' LIMIT 1`);
      const defaultUserId = defaultUser.rows[0]?.id;

      if (defaultUserId) {
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER`);
        await pool.query(`UPDATE transactions SET user_id = $1 WHERE user_id IS NULL`, [defaultUserId]);
        await pool.query(`ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL`);
        await pool.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
      }
    } else {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
          amount DECIMAL(10, 2) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log("Transactions table created/verified");

    // Check and migrate planned_expenses table
    const plannedCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'planned_expenses' AND column_name = 'user_id'
    `);

    if (plannedCheck.rows.length === 0) {
      console.log("Migrating planned_expenses table...");
      
      const defaultUser = await pool.query(`SELECT id FROM users WHERE email = 'migrated@example.com' LIMIT 1`);
      const defaultUserId = defaultUser.rows[0]?.id;

      if (defaultUserId) {
        await pool.query(`ALTER TABLE planned_expenses ADD COLUMN IF NOT EXISTS user_id INTEGER`);
        await pool.query(`UPDATE planned_expenses SET user_id = $1 WHERE user_id IS NULL`, [defaultUserId]);
        await pool.query(`ALTER TABLE planned_expenses ALTER COLUMN user_id SET NOT NULL`);
        await pool.query(`ALTER TABLE planned_expenses ADD CONSTRAINT planned_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
      }
    } else {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS planned_expenses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log("Planned expenses table created/verified");

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_planned_expenses_user ON planned_expenses(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_planned_expenses_date ON planned_expenses(date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_planned_expenses_category ON planned_expenses(category_id)`);

    console.log("Indexes created/verified");
    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
