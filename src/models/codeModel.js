import { query } from "../Configuration/database.js";
import crypto from "crypto";

// Generate a unique code
const generateCode = () => {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString("hex").toUpperCase());
  }
  return segments.join("-");
};

// Create a new code
export const createCode = async (type, userId = null, expiresAt = null) => {
  const code = generateCode();

  try {
    const result = await query(
      `INSERT INTO codes (code, type, user_id, expires_at, status) 
       VALUES ($1, $2, $3, $4, 'active') 
       RETURNING *`,
      [code, type, userId, expiresAt]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating code:", error);
    throw error;
  }
};

// Create trial code (7 days expiry)
export const createTrialCode = async (userId = null, externalToken = null) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  // Use external token as code if provided, otherwise generate new one
  const code = externalToken || generateCode();

  try {
    const result = await query(
      `INSERT INTO codes (code, type, user_id, expires_at, status) 
       VALUES ($1, $2, $3, $4, 'active') 
       RETURNING *`,
      [code, "trial", userId, expiresAt]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating trial code:", error);
    throw error;
  }
};

// Create premium code (no expiry)
export const createPremiumCode = async (
  userId = null,
  externalToken = null
) => {
  // Use external token as code if provided, otherwise generate new one
  const code = externalToken || generateCode();

  try {
    const result = await query(
      `INSERT INTO codes (code, type, user_id, expires_at, status) 
       VALUES ($1, $2, $3, $4, 'active') 
       RETURNING *`,
      [code, "premium", userId, null]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating premium code:", error);
    throw error;
  }
};

// Get code by code string
export const getCodeByCode = async (codeString) => {
  try {
    const result = await query("SELECT * FROM codes WHERE code = $1", [
      codeString,
    ]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting code:", error);
    throw error;
  }
};

// Get code by id
export const getCodeById = async (id) => {
  try {
    const result = await query("SELECT * FROM codes WHERE id = $1", [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting code by id:", error);
    throw error;
  }
};

// Activate code (assign to user)
export const activateCode = async (codeString, userId) => {
  try {
    // Check if code exists and is active
    const codeData = await getCodeByCode(codeString);

    if (!codeData) {
      throw new Error("Code not found");
    }

    if (codeData.status !== "active") {
      throw new Error(`Code is ${codeData.status}`);
    }

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      // Mark as expired
      await query(
        "UPDATE codes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        ["expired", codeData.id]
      );
      throw new Error("Code has expired");
    }

    // Activate the code
    const result = await query(
      `UPDATE codes 
       SET user_id = $1, 
           status = 'used',
           activated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE code = $2
       RETURNING *`,
      [userId, codeString]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error activating code:", error);
    throw error;
  }
};

// Get all codes (with pagination and filters)
export const getAllCodes = async (filters = {}, limit = 50, offset = 0) => {
  const { type, status, userId } = filters;

  let queryText = "SELECT * FROM codes WHERE 1=1";
  const params = [];
  let paramCount = 0;

  if (type) {
    paramCount++;
    queryText += ` AND type = $${paramCount}`;
    params.push(type);
  }

  if (status) {
    paramCount++;
    queryText += ` AND status = $${paramCount}`;
    params.push(status);
  }

  if (userId) {
    paramCount++;
    queryText += ` AND user_id = $${paramCount}`;
    params.push(userId);
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${
    paramCount + 2
  }`;
  params.push(limit, offset);

  try {
    const result = await query(queryText, params);
    return result.rows;
  } catch (error) {
    console.error("Error getting all codes:", error);
    throw error;
  }
};

// Get codes statistics
export const getCodesStats = async () => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN type = 'trial' THEN 1 END) as trial_count,
        COUNT(CASE WHEN type = 'premium' THEN 1 END) as premium_count,
        COUNT(CASE WHEN type = 'enterprise' THEN 1 END) as enterprise_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'used' THEN 1 END) as used_count,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count
      FROM codes
    `);
    return result.rows[0];
  } catch (error) {
    console.error("Error getting codes stats:", error);
    throw error;
  }
};

// Expire old codes (run this periodically)
export const expireOldCodes = async () => {
  try {
    const result = await query(
      `UPDATE codes 
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE expires_at < CURRENT_TIMESTAMP 
         AND status = 'active'
       RETURNING *`
    );
    console.log(`Expired ${result.rowCount} codes`);
    return result.rows;
  } catch (error) {
    console.error("Error expiring old codes:", error);
    throw error;
  }
};

// Check if code is valid (active and not expired)
export const isCodeValid = async (codeString) => {
  try {
    const codeData = await getCodeByCode(codeString);

    if (!codeData) {
      return {
        valid: false,
        reason: "Code not found",
        code: null,
      };
    }

    if (codeData.status !== "active") {
      return {
        valid: false,
        reason: `Code is ${codeData.status}`,
        code: codeData,
      };
    }

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      // Auto-mark as expired
      await query(
        "UPDATE codes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        ["expired", codeData.id]
      );

      return {
        valid: false,
        reason: "Code has expired",
        code: codeData,
      };
    }

    return {
      valid: true,
      reason: "Code is valid",
      code: codeData,
    };
  } catch (error) {
    console.error("Error checking code validity:", error);
    throw error;
  }
};

// Deactivate code (change status from active to non-active)
export const deactivateCode = async (codeString) => {
  try {
    const codeData = await getCodeByCode(codeString);

    if (!codeData) {
      throw new Error("Code not found");
    }

    if (codeData.status !== "active") {
      throw new Error(`Code is already ${codeData.status}`);
    }

    const result = await query(
      `UPDATE codes 
       SET status = 'used', 
           updated_at = CURRENT_TIMESTAMP
       WHERE code = $1
       RETURNING *`,
      [codeString]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error deactivating code:", error);
    throw error;
  }
};
