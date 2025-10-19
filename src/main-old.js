import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { loadConfig } from "./Configuration/configLoader.js";
import { ApiPaymentAxios } from "./Configuration/config.js";
import { generatePaymentRequest } from "./Payment/momo.js";
import { initDatabase } from "./Configuration/database.js";
import {
  createUser,
  getUserByEmail,
  getUserByCCCD,
  hasReceivedTrialCode,
  markTrialCodeReceived,
} from "./models/userModel.js";
import { createPremiumCode, createTrialCode } from "./models/codeModel.js";
import {
  createTransaction,
  updateTransactionStatus,
  linkCodeToTransaction,
  getTransactionByOrderId,
} from "./models/transactionModel.js";
import {
  sendTrialCodeEmail,
  sendPremiumCodeEmail,
} from "./services/emailService.js";
import {
  generateTrialToken,
  generatePremiumToken,
} from "./services/externalApiService.js";

dotenv.config();

// Load configuration
const config = loadConfig();

const app = express();
const PORT = config.server.port || process.env.PORT || 3000;
const ADMIN_PORTAL_URL =
  config.server.adminPortalUrl ||
  process.env.ADMIN_PORTAL_URL ||
  "http://localhost:5173";

const SERVER_BASE_URL =
  config.server.baseUrl ||
  process.env.SERVER_BASE_URL ||
  `http://localhost:${PORT}`;

const urlCallbackRedirect = `${SERVER_BASE_URL}/callback-momo/redirect`;
const urlCallbackIpnUrl = `${SERVER_BASE_URL}/callback-momo/ipn-url`;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Initialize database on startup
initDatabase().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

// MoMo IPN (Instant Payment Notification) - POST callback
app.post("/callback-momo/ipn-url", async (req, res) => {
  console.log("\n🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵");
  console.log("� MOMO IPN CALLBACK RECEIVED (POST)");
  console.log("🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵");
  console.log("📍 IPN URL:", req.originalUrl);
  console.log("🕐 Received at:", new Date().toISOString());
  console.log("📋 Body params:", JSON.stringify(req.body, null, 2));
  console.log("🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵\n");

  const { orderId, resultCode, message, transId, amount } = req.body;

  try {
    console.log(`📋 IPN Step 1: Fetching transaction for orderId: ${orderId}`);
    // Get transaction from database
    const transaction = await getTransactionByOrderId(orderId);

    if (!transaction) {
      console.error("❌ IPN: Transaction not found:", orderId);
      return res.status(404).json({
        status: "error",
        message: "Transaction not found",
      });
    }
    console.log(`✅ IPN: Transaction found:`, transaction.id);

    // ⚠️ TEST MODE: ALWAYS create code and send email regardless of resultCode
    console.log(
      `\n🧪 IPN TEST MODE: Processing ALL payments (success/cancel/fail) for orderId ${orderId}`
    );
    console.log(
      `📊 MoMo resultCode: ${resultCode} (${
        resultCode === 0
          ? "SUCCESS"
          : resultCode === 1006
          ? "USER_CANCEL"
          : "ERROR"
      })`
    );
    console.log(
      `🎯 IPN TEST MODE: Will create premium code and send email anyway!`
    );

    console.log(`📋 IPN Step 2: Updating transaction status...`);
    // Update transaction status as success
    await updateTransactionStatus(orderId, "success", {
      transId,
      resultCode,
      message,
      testMode: true,
      ipnReceived: true,
    });
    console.log(`✅ IPN: Transaction status updated to: success`);

    // Get user info from transaction
    const paymentData = transaction.payment_data;
    console.log(`\n📋 IPN Step 3: Payment data extracted:`, {
      email: paymentData.email,
      company: paymentData.nameCompany,
      cccd: paymentData.cccd,
    });

    console.log(`\n📋 IPN Step 4: Generating premium token...`);
    // Generate premium token from external API (or test generator)
    const tokenResponse = await generatePremiumToken(
      paymentData.nameCompany,
      paymentData.email,
      paymentData.cccd
    );
    console.log(`✅ IPN: Token generated:`, tokenResponse);

    // Extract token from response
    const tokenPremium = tokenResponse.tokenPremium || tokenResponse.token;
    console.log(`📝 IPN: Token premium:`, tokenPremium);

    console.log(`\n📋 IPN Step 5: Creating premium code in database...`);
    // Create premium code for user
    const code = await createPremiumCode(transaction.user_id, tokenPremium);
    console.log(`✅ IPN: Premium code created:`, code.code);
    console.log(`📊 IPN: Code details:`, {
      id: code.id,
      code: code.code,
      user_id: code.user_id,
      type: code.type,
      status: code.status,
    });

    console.log(`\n📋 IPN Step 6: Linking code to transaction...`);
    // Link code to transaction
    await linkCodeToTransaction(orderId, code.id);
    console.log(`✅ IPN: Code linked to transaction`);

    console.log(`\n📋 IPN Step 7: Sending premium email...`);
    // Send email with premium code
    try {
      console.log(
        `📧 IPN: Attempting to send premium email to: ${paymentData.email}`
      );
      console.log(`📧 IPN: Email params:`, {
        email: paymentData.email,
        nameCompany: paymentData.nameCompany,
        premiumCode: code.code,
        orderId: orderId,
        amount: amount,
        transactionDate: new Date().toLocaleString("vi-VN"),
      });

      await sendPremiumCodeEmail({
        email: paymentData.email,
        nameCompany: paymentData.nameCompany,
        premiumCode: code.code,
        orderId: orderId,
        amount: amount,
        transactionDate: new Date().toLocaleString("vi-VN"),
      });
      console.log(
        `✅ IPN: Premium email sent successfully to: ${paymentData.email}`
      );
      console.log(
        `✉️ IPN: Please check inbox (and spam folder) of: ${paymentData.email}`
      );
    } catch (emailError) {
      console.error(
        `❌ IPN: Failed to send premium email to ${paymentData.email}:`
      );
      console.error(`❌ IPN: Error name:`, emailError.name);
      console.error(`❌ IPN: Error message:`, emailError.message);
      console.error(`❌ IPN: Error stack:`, emailError.stack);
      if (emailError.response) {
        console.error(`❌ IPN: API Response:`, emailError.response.data);
      }
      // Continue even if email fails
    }

    console.log(
      `\n✅ IPN: Premium code created (TEST MODE): ${code.code} for order ${orderId}`
    );
    console.log(`====================================\n`);

    // Return success response to MoMo
    return res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      orderId: orderId,
      code: code.code,
    });
  } catch (error) {
    console.error("\n❌❌❌ IPN CALLBACK ERROR ❌❌❌");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("====================================\n");

    return res.status(500).json({
      status: "error",
      message: "Processing error",
      error: error.message,
    });
  }
});

// API: Check callback status for order
app.get("/api/callback/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const { getTransactionByOrderId } = await import(
      "./models/transactionModel.js"
    );
    const transaction = await getTransactionByOrderId(orderId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
        callbackReceived: false,
        status: "not_found",
      });
    }

    const callbackReceived = transaction.status !== "pending";

    return res.status(200).json({
      success: true,
      orderId: orderId,
      callbackReceived: callbackReceived,
      status: transaction.status,
      paymentData: transaction.payment_data,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      details: transaction.callback_data || null,
    });
  } catch (error) {
    console.error("Error checking callback status:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking callback status",
      error: error.message,
    });
  }
});

// API: Check code validity
app.get("/api/code/check/:code", async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Code parameter is required",
      });
    }

    const { isCodeValid } = await import("./models/codeModel.js");
    const result = await isCodeValid(code);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error checking code validity:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking code validity",
      error: error.message,
    });
  }
});

// API: Deactivate code
app.post("/api/code/deactivate", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Code is required in request body",
      });
    }

    const { deactivateCode } = await import("./models/codeModel.js");
    const deactivatedCode = await deactivateCode(code);

    return res.status(200).json({
      success: true,
      message: "Code deactivated successfully",
      code: deactivatedCode,
    });
  } catch (error) {
    console.error("Error deactivating code:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error deactivating code",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "MyShop Admin Portal Backend API",
    version: "1.0.0",
  });
});

// Request trial code API
app.post("/api/request-trial", async (req, res) => {
  const { email, nameCompany, cccd } = req.body;

  // Validate required fields
  if (!email || !nameCompany || !cccd) {
    return res.status(400).json({
      success: false,
      message: "Email, tên công ty và CCCD là bắt buộc",
    });
  }

  try {
    // Check if CCCD already received trial code
    const alreadyReceived = await hasReceivedTrialCode(cccd);

    if (alreadyReceived) {
      return res.status(400).json({
        success: false,
        message:
          "CCCD này đã nhận code trial trước đó. Mỗi CCCD chỉ được nhận 1 code trial duy nhất.",
      });
    }

    // Create or get user
    let user = await getUserByCCCD(cccd);

    if (!user) {
      user = await createUser(email, nameCompany, null, cccd);
    }

    // Generate trial token from external API (or test generator)
    const tokenResponse = await generateTrialToken(nameCompany, email, cccd);

    // Extract token from response
    const tokenTrial = tokenResponse.tokenTrial || tokenResponse.token;

    // Create trial code in database
    const code = await createTrialCode(user.id, tokenTrial);

    // Mark user as received trial code
    await markTrialCodeReceived(user.id);

    // Send email with trial code
    await sendTrialCodeEmail({
      email: email,
      nameCompany: nameCompany,
      trialCode: code.code,
      expiryDate: code.expires_at,
    });

    console.log(`Trial code created: ${code.code} for ${email}`);

    return res.json({
      success: true,
      message: "Code Trial đã được gửi đến email của bạn!",
      data: {
        code: code.code,
        type: code.type,
        expiresAt: code.expires_at,
      },
    });
  } catch (error) {
    console.error("Error creating trial code:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo code trial. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
});

// Request premium code API (redirect to MoMo payment)
app.post("/api/request-premium", async (req, res) => {
  const { email, nameCompany, cccd } = req.body;

  // Validate required fields
  if (!email || !nameCompany || !cccd) {
    return res.status(400).json({
      success: false,
      message: "Email, tên công ty và CCCD là bắt buộc",
    });
  }

  try {
    // Create or get user
    let user = await getUserByCCCD(cccd);

    if (!user) {
      user = await createUser(email, nameCompany, null, cccd);
    }

    // Create payment request
    const amount = config.payment.premiumPrice || 199000;
    const paymentRequest = generatePaymentRequest(
      urlCallbackRedirect,
      urlCallbackIpnUrl,
      amount
    );

    // Create pending transaction in database
    await createTransaction({
      orderId: paymentRequest.orderId,
      userId: user.id,
      amount: amount,
      currency: "VND",
      paymentGateway: "momo",
      status: "pending",
      paymentData: {
        productType: "premium",
        email,
        nameCompany,
        cccd,
      },
    });

    // Send payment request to MoMo
    const response = await ApiPaymentAxios.post("/create", paymentRequest);

    if (!response.data || !response.data.payUrl) {
      throw new Error("MoMo payment URL not received");
    }

    console.log(`💳 Payment created: ${paymentRequest.orderId} for ${email}`);
    console.log(`🔗 Payment URL: ${response.data.payUrl}`);
    console.log(`⏳ Waiting for MoMo callback...`);
    console.log(`📍 Expected callback URLs:`);
    console.log(
      `   - GET Redirect: ${urlCallbackRedirect}?orderId=${paymentRequest.orderId}...`
    );
    console.log(`   - POST IPN: ${urlCallbackIpnUrl}`);
    console.log(
      `\n⚠️  TEST MODE: Premium code will be created ONLY when callback is received!`
    );
    console.log(`   - If user pays → Callback received → Email sent ✅`);
    console.log(
      `   - If user cancels → Callback received → Email sent anyway ✅ (test mode)`
    );
    console.log(`   - If no callback → No email sent ❌\n`);

    return res.json({
      success: true,
      message: "Đang chuyển đến trang thanh toán...",
      paymentUrl: response.data.payUrl,
      orderId: paymentRequest.orderId,
    });
  } catch (error) {
    console.error("❌ Error creating payment:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo yêu cầu thanh toán. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
});

app.get("/callback-momo/redirect", async (req, res) => {
  console.log("\n🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢");
  console.log("✅ MOMO CALLBACK RECEIVED (GET REDIRECT)");
  console.log("🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢");
  console.log("📍 Callback URL:", req.originalUrl);
  console.log("🕐 Received at:", new Date().toISOString());
  console.log("📋 Query params:", JSON.stringify(req.query, null, 2));
  console.log("🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢\n");

  const { orderId, resultCode, message, transId, amount } = req.query;

  console.log("\n====================================");
  console.log(req.query);

  try {
    console.log(`📋 Step 1: Fetching transaction for orderId: ${orderId}`);
    // Get transaction from database
    const transaction = await getTransactionByOrderId(orderId);

    if (!transaction) {
      console.error("❌ Transaction not found:", orderId);
      return res.redirect(
        `${ADMIN_PORTAL_URL}/payment-error?error=transaction_not_found`
      );
    }
    console.log(`✅ Transaction found:`, transaction.id);

    // ⚠️ TEST MODE: ALWAYS create code and send email regardless of resultCode
    console.log(
      `\n🧪 TEST MODE: Processing ALL payments (success/cancel/fail) for orderId ${orderId}`
    );
    console.log(
      `📊 MoMo resultCode: ${resultCode} (${
        resultCode === "0"
          ? "SUCCESS"
          : resultCode === "1006"
          ? "USER_CANCEL"
          : "ERROR"
      })`
    );
    console.log(
      `🎯 TEST MODE: Will create premium code and send email anyway!`
    );
    console.log(`📋 Step 2: Updating transaction status...`);
    // Update transaction status as success
    await updateTransactionStatus(orderId, "success", {
      transId,
      resultCode,
      message,
      testMode: true,
    });
    console.log(`✅ Transaction status updated to: success`);

    // Get user info from transaction
    const paymentData = transaction.payment_data;
    console.log(`\n📋 Step 3: Payment data extracted:`, {
      email: paymentData.email,
      company: paymentData.nameCompany,
      cccd: paymentData.cccd,
    });

    console.log(`\n📋 Step 4: Generating premium token...`);
    // Generate premium token from external API (or test generator)
    const tokenResponse = await generatePremiumToken(
      paymentData.nameCompany,
      paymentData.email,
      paymentData.cccd
    );
    console.log(`✅ Token generated:`, tokenResponse);

    // Extract token from response
    const tokenPremium = tokenResponse.tokenPremium || tokenResponse.token;
    console.log(`📝 Token premium:`, tokenPremium);

    console.log(`\n📋 Step 5: Creating premium code in database...`);
    // Create premium code for user
    const code = await createPremiumCode(transaction.user_id, tokenPremium);
    console.log(`✅ Premium code created:`, code.code);

    console.log(`\n📋 Step 6: Linking code to transaction...`);
    // Link code to transaction
    await linkCodeToTransaction(orderId, code.id);
    console.log(`✅ Code linked to transaction`);

    console.log(`\n📋 Step 7: Sending premium email...`);
    // Send email with premium code
    try {
      console.log(
        `📧 Attempting to send premium email to: ${paymentData.email}`
      );
      console.log(`📧 Email params:`, {
        email: paymentData.email,
        nameCompany: paymentData.nameCompany,
        premiumCode: code.code,
        orderId: orderId,
        amount: amount,
        transactionDate: new Date().toLocaleString("vi-VN"),
      });

      await sendPremiumCodeEmail({
        email: paymentData.email,
        nameCompany: paymentData.nameCompany,
        premiumCode: code.code,
        orderId: orderId,
        amount: amount,
        transactionDate: new Date().toLocaleString("vi-VN"),
      });
      console.log(
        `✅ Premium email sent successfully to: ${paymentData.email}`
      );
      console.log(
        `✉️ Please check inbox (and spam folder) of: ${paymentData.email}`
      );
    } catch (emailError) {
      console.error(`❌ Failed to send premium email to ${paymentData.email}:`);
      console.error(`❌ Error name:`, emailError.name);
      console.error(`❌ Error message:`, emailError.message);
      console.error(`❌ Error stack:`, emailError.stack);
      if (emailError.response) {
        console.error(`❌ API Response:`, emailError.response.data);
      }
      // Continue even if email fails - user still gets code in redirect
    }

    console.log(
      `\n✅ Premium code created (TEST MODE): ${code.code} for order ${orderId}`
    );

    console.log(`\n📋 Step 8: Redirecting to success page...`);
    const redirectUrl = `${ADMIN_PORTAL_URL}/payment-success?orderId=${orderId}&transId=${
      transId || "TEST"
    }&amount=${amount}&code=${code.code}`;
    console.log(`🔗 Redirect URL:`, redirectUrl);
    console.log(`====================================\n`);

    // ALWAYS redirect to success page
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("\n❌❌❌ CALLBACK ERROR ❌❌❌");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("====================================\n");

    return res.redirect(
      `${ADMIN_PORTAL_URL}/payment-error?error=processing_error&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
});
