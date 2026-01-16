import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Очищаем имя базы данных от лишних символов
const dbName = (process.env.DB_NAME || "finance_assistant").trim().replace(/[;,\s]+$/, "");

async function migrate() {
  try {
    console.log("Starting database migration...");

    // Сначала подключаемся к системной базе данных postgres для создания базы данных
    const adminPool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      database: "postgres", // Подключаемся к системной БД
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
    });

    // Проверяем, существует ли база данных
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      // Создаем базу данных (нельзя использовать параметры для имени БД, поэтому используем безопасное экранирование)
      // Используем pg_escape_identifier через идентификатор в кавычках
      const escapedDbName = `"${dbName.replace(/"/g, '""')}"`;
      await adminPool.query(`CREATE DATABASE ${escapedDbName}`);
      console.log(`Database "${dbName}" created successfully`);
    } else {
      console.log(`Database "${dbName}" already exists`);
    }

    await adminPool.end();

    // Теперь подключаемся к нужной базе данных
    const pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      database: dbName,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
    });

    // Check if users table exists
    const usersTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!usersTableExists.rows[0].exists) {
      // Create users table if it doesn't exist
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255),
          login VARCHAR(100) UNIQUE,
          password_hash VARCHAR(255),
          name VARCHAR(100),
          google_id VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT users_email_or_login_check CHECK (
            (email IS NOT NULL AND password_hash IS NOT NULL) OR 
            (login IS NOT NULL AND password_hash IS NOT NULL) OR 
            (google_id IS NOT NULL)
          )
        );
      `);
      console.log("Users table created");
    } else {
      // Table exists, migrate it
      console.log("Users table exists, checking for migration...");
      
      // Check if login column exists
      const loginColumnExists = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'login'
      `);
      
      if (loginColumnExists.rows.length === 0) {
        console.log("Migrating users table: adding login and google_id columns...");
        
        // Add new columns
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login VARCHAR(100)`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`);
        
        // Make email and password_hash nullable
        try {
          await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
        } catch (e) {
          // Column might already be nullable
          console.log("Email column might already be nullable");
        }
        
        try {
          await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
        } catch (e) {
          // Column might already be nullable
          console.log("Password_hash column might already be nullable");
        }
        
        // Drop old unique constraint on email if it exists
        try {
          await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`);
        } catch (e) {
          // Ignore if constraint doesn't exist
        }
        
        // Create unique indexes
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique ON users(login) WHERE login IS NOT NULL`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL`);
        
        // Generate login from email for existing users
        await pool.query(`
          UPDATE users 
          SET login = SPLIT_PART(email, '@', 1) 
          WHERE login IS NULL AND email IS NOT NULL
        `);
        
        // Add CHECK constraint if it doesn't exist
        try {
          await pool.query(`
            ALTER TABLE users ADD CONSTRAINT users_email_or_login_check CHECK (
              (email IS NOT NULL AND password_hash IS NOT NULL) OR 
              (login IS NOT NULL AND password_hash IS NOT NULL) OR 
              (google_id IS NOT NULL)
            )
          `);
        } catch (e) {
          // Constraint might already exist
          console.log("CHECK constraint might already exist");
        }
        
        console.log("Users table migration completed");
      }
    }
    console.log("Users table created/verified");

    // Check if categories table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'categories'
      );
    `);

    if (tableExists.rows[0].exists) {
      // Table exists, check if it has user_id column
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
      }
    } else {
      // Table doesn't exist, create it
      console.log("Creating categories table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(7) NOT NULL,
          icon VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        );
      `);
    }
    console.log("Categories table created/verified");

    // Check if transactions table exists
    const transactionsTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      );
    `);

    if (transactionsTableExists.rows[0].exists) {
      // Table exists, check if it has user_id column
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
      }
    } else {
      // Table doesn't exist, create it
      console.log("Creating transactions table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
          amount DECIMAL(10, 2) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log("Transactions table created/verified");

    // Check if planned_expenses table exists
    const plannedTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'planned_expenses'
      );
    `);

    if (plannedTableExists.rows[0].exists) {
      // Table exists, check if it has user_id column
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
      }
    } else {
      // Table doesn't exist, create it
      console.log("Creating planned_expenses table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS planned_expenses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log("Planned expenses table created/verified");

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_login ON users(login) WHERE login IS NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_planned_expenses_user ON planned_expenses(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_planned_expenses_date ON planned_expenses(date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_planned_expenses_category ON planned_expenses(category_id)`);

    console.log("Indexes created/verified");
    console.log("Migration completed successfully");
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
