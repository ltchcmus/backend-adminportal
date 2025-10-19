import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Log database URL for debugging (hide password)
const dbUrl = process.env.DATABASE_URL || "NOT_SET";
const maskedUrl = dbUrl.replace(/:([^@]+)@/, ":****@");
console.log("🔍 Database URL:", maskedUrl);

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for NeonDB
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  query_timeout: 30000, // Query timeout 30 seconds
});

// Test database connection
pool.on("connect", () => {
  console.log("✅ Connected to NeonDB PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle database client", err);
  process.exit(-1);
});

// Query helper function
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Executed query", { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

// Get a client from the pool (for transactions)
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error("A client has been checked out for more than 5 seconds!");
  }, 5000);

  // Monkey patch the release method to clear our timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };

  return { query, release };
};

// Initialize database tables
export const initDatabase = async () => {
  try {
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(20),
        cccd VARCHAR(20) UNIQUE,
        trial_code_received BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Users table created or already exists");

    // Create codes table
    await query(`
      CREATE TABLE IF NOT EXISTS codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('trial', 'premium', 'enterprise')),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP,
        activated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Codes table created or already exists");

    // Alter codes table to increase code column length if it exists
    try {
      await query(`
        ALTER TABLE codes ALTER COLUMN code TYPE VARCHAR(100);
      `);
      console.log(
        "✅ Codes table updated: code column extended to VARCHAR(100)"
      );
    } catch (alterError) {
      // Ignore if column already has correct type
      console.log(
        "ℹ️ Codes table column already correct or doesn't need update"
      );
    }

    // Create transactions table
    await query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(100) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        code_id INTEGER REFERENCES codes(id) ON DELETE SET NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'VND',
        payment_method VARCHAR(50),
        payment_gateway VARCHAR(50),
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'refunded')),
        trans_id VARCHAR(100),
        result_code VARCHAR(10),
        message TEXT,
        payment_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Transactions table created or already exists");

    // Create indexes for better performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_cccd ON users(cccd);
      CREATE INDEX IF NOT EXISTS idx_users_trial_received ON users(trial_code_received);
      CREATE INDEX IF NOT EXISTS idx_codes_code ON codes(code);
      CREATE INDEX IF NOT EXISTS idx_codes_user_id ON codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_codes_status ON codes(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    `);
    console.log("✅ Database indexes created or already exist");

    console.log("🎉 Database initialization completed successfully");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing database pool");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing database pool");
  await pool.end();
  process.exit(0);
});

export default pool;
