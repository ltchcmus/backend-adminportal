import { query } from "../Configuration/database.js";

// Create a new user
export const createUser = async (
  email,
  name = null,
  phone = null,
  cccd = null
) => {
  try {
    const result = await query(
      `INSERT INTO users (email, name, phone, cccd) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) 
       DO UPDATE SET 
         name = COALESCE($2, users.name),
         phone = COALESCE($3, users.phone),
         cccd = COALESCE($4, users.cccd),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [email, name, phone, cccd]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

// Get user by email
export const getUserByEmail = async (email) => {
  try {
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    throw error;
  }
};

// Get user by id
export const getUserById = async (id) => {
  try {
    const result = await query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting user by id:", error);
    throw error;
  }
};

// Update user
export const updateUser = async (id, updates) => {
  const { name, phone } = updates;
  try {
    const result = await query(
      `UPDATE users 
       SET name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, name, phone]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

// Get all users (with pagination)
export const getAllUsers = async (limit = 50, offset = 0) => {
  try {
    const result = await query(
      `SELECT * FROM users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting all users:", error);
    throw error;
  }
};

// Get user's codes
export const getUserCodes = async (userId) => {
  try {
    const result = await query(
      `SELECT * FROM codes 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting user codes:", error);
    throw error;
  }
};

// Get user's transactions
export const getUserTransactions = async (userId) => {
  try {
    const result = await query(
      `SELECT * FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting user transactions:", error);
    throw error;
  }
};

// Get user by CCCD
export const getUserByCCCD = async (cccd) => {
  try {
    const result = await query("SELECT * FROM users WHERE cccd = $1", [cccd]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting user by CCCD:", error);
    throw error;
  }
};

// Check if user has received trial code
export const hasReceivedTrialCode = async (cccd) => {
  try {
    const result = await query(
      "SELECT trial_code_received FROM users WHERE cccd = $1",
      [cccd]
    );
    return result.rows[0]?.trial_code_received || false;
  } catch (error) {
    console.error("Error checking trial code status:", error);
    throw error;
  }
};

// Mark user as received trial code
export const markTrialCodeReceived = async (userId) => {
  try {
    const result = await query(
      `UPDATE users 
       SET trial_code_received = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error marking trial code received:", error);
    throw error;
  }
};
