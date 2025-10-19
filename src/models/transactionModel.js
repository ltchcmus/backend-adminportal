import { query } from "../Configuration/database.js";

// Create a new transaction
export const createTransaction = async (transactionData) => {
  const {
    orderId,
    userId = null,
    codeId = null,
    amount,
    currency = "VND",
    paymentMethod = null,
    paymentGateway = "momo",
    status = "pending",
    transId = null,
    resultCode = null,
    message = null,
    paymentData = null,
  } = transactionData;

  try {
    const result = await query(
      `INSERT INTO transactions 
       (order_id, user_id, code_id, amount, currency, payment_method, 
        payment_gateway, status, trans_id, result_code, message, payment_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        orderId,
        userId,
        codeId,
        amount,
        currency,
        paymentMethod,
        paymentGateway,
        status,
        transId,
        resultCode,
        message,
        paymentData ? JSON.stringify(paymentData) : null,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw error;
  }
};

// Get transaction by order ID
export const getTransactionByOrderId = async (orderId) => {
  try {
    const result = await query(
      "SELECT * FROM transactions WHERE order_id = $1",
      [orderId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting transaction by order ID:", error);
    throw error;
  }
};

// Get transaction by id
export const getTransactionById = async (id) => {
  try {
    const result = await query("SELECT * FROM transactions WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting transaction by id:", error);
    throw error;
  }
};

// Update transaction status
export const updateTransactionStatus = async (
  orderId,
  status,
  additionalData = {}
) => {
  const { transId, resultCode, message, paymentData } = additionalData;

  try {
    const result = await query(
      `UPDATE transactions 
       SET status = $1,
           trans_id = COALESCE($2, trans_id),
           result_code = COALESCE($3, result_code),
           message = COALESCE($4, message),
           payment_data = COALESCE($5, payment_data),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $6
       RETURNING *`,
      [
        status,
        transId,
        resultCode,
        message,
        paymentData ? JSON.stringify(paymentData) : null,
        orderId,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error updating transaction status:", error);
    throw error;
  }
};

// Link code to transaction
export const linkCodeToTransaction = async (orderId, codeId) => {
  try {
    const result = await query(
      `UPDATE transactions 
       SET code_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2
       RETURNING *`,
      [codeId, orderId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error linking code to transaction:", error);
    throw error;
  }
};

// Get all transactions (with pagination and filters)
export const getAllTransactions = async (
  filters = {},
  limit = 50,
  offset = 0
) => {
  const { status, userId, paymentGateway, startDate, endDate } = filters;

  let queryText = "SELECT * FROM transactions WHERE 1=1";
  const params = [];
  let paramCount = 0;

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

  if (paymentGateway) {
    paramCount++;
    queryText += ` AND payment_gateway = $${paramCount}`;
    params.push(paymentGateway);
  }

  if (startDate) {
    paramCount++;
    queryText += ` AND created_at >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    queryText += ` AND created_at <= $${paramCount}`;
    params.push(endDate);
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${
    paramCount + 2
  }`;
  params.push(limit, offset);

  try {
    const result = await query(queryText, params);
    return result.rows;
  } catch (error) {
    console.error("Error getting all transactions:", error);
    throw error;
  }
};

// Get transaction statistics
export const getTransactionStats = async (filters = {}) => {
  const { startDate, endDate } = filters;

  let queryText = `
    SELECT 
      COUNT(*) as total_transactions,
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
      COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_revenue,
      COALESCE(AVG(CASE WHEN status = 'success' THEN amount ELSE NULL END), 0) as average_transaction
    FROM transactions
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  if (startDate) {
    paramCount++;
    queryText += ` AND created_at >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    queryText += ` AND created_at <= $${paramCount}`;
    params.push(endDate);
  }

  try {
    const result = await query(queryText, params);
    return result.rows[0];
  } catch (error) {
    console.error("Error getting transaction stats:", error);
    throw error;
  }
};

// Get daily revenue (for charts)
export const getDailyRevenue = async (days = 30) => {
  try {
    const result = await query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as transaction_count,
         COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as revenue
       FROM transactions
       WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting daily revenue:", error);
    throw error;
  }
};
