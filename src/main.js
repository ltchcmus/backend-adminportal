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

const config = loadConfig();

const app = express();
const PORT = config.server.port || process.env.PORT || 3000;

// Priority: environment variable > config.yaml > default
const ADMIN_PORTAL_URL =
  process.env.ADMIN_PORTAL_URL ||
  config.server.adminPortalUrl ||
  "http://localhost:5173";

const SERVER_BASE_URL =
  process.env.SERVER_BASE_URL ||
  config.server.baseUrl ||
  `http://localhost:${PORT}`;

console.log("🌐 Server Configuration:");
console.log("   SERVER_BASE_URL:", SERVER_BASE_URL);
console.log("   ADMIN_PORTAL_URL:", ADMIN_PORTAL_URL);

const urlCallbackRedirect = `${SERVER_BASE_URL}/callback-momo/redirect`;
const urlCallbackIpnUrl = `${SERVER_BASE_URL}/callback-momo/ipn-url`;

console.log("💳 MoMo Callbacks:");
console.log("   Redirect URL:", urlCallbackRedirect);
console.log("   IPN URL:", urlCallbackIpnUrl);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

initDatabase().catch((err) => {
  process.exit(1);
});

app.post("/callback-momo/ipn-url", async (req, res) => {
  const { orderId, resultCode, message, transId, amount } = req.body;

  try {
    const transaction = await getTransactionByOrderId(orderId);

    if (!transaction) {
      return res.status(404).json({
        status: "error",
        message: "Transaction not found",
      });
    }

    await updateTransactionStatus(orderId, "success", {
      transId,
      resultCode,
      message,
      testMode: true,
      ipnReceived: true,
    });

    const paymentData = transaction.payment_data;

    const tokenResponse = await generatePremiumToken(
      paymentData.nameCompany,
      paymentData.email,
      paymentData.cccd
    );

    const tokenPremium = tokenResponse.tokenPremium || tokenResponse.token;
    const code = await createPremiumCode(transaction.user_id, tokenPremium);
    await linkCodeToTransaction(orderId, code.id);

    try {
      await sendPremiumCodeEmail({
        email: paymentData.email,
        nameCompany: paymentData.nameCompany,
        premiumCode: code.code,
        orderId: orderId,
        amount: amount,
        transactionDate: new Date().toLocaleString("vi-VN"),
      });
    } catch (emailError) {
      // Continue even if email fails
    }

    return res.status(200).json({
      status: "success",
      message: "Payment processed successfully",
      orderId: orderId,
      code: code.code,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Processing error",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  // Server started
});

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "MyShop Admin Portal Backend API",
    version: "1.0.0",
  });
});

app.post("/api/request-trial", async (req, res) => {
  const { email, nameCompany, cccd } = req.body;

  if (!email || !nameCompany || !cccd) {
    return res.status(400).json({
      success: false,
      message: "Email, tên công ty và CCCD là bắt buộc",
    });
  }

  try {
    const alreadyReceived = await hasReceivedTrialCode(cccd);

    if (alreadyReceived) {
      return res.status(400).json({
        success: false,
        message:
          "CCCD này đã nhận code trial trước đó. Mỗi CCCD chỉ được nhận 1 code trial duy nhất.",
      });
    }

    let user = await getUserByCCCD(cccd);

    if (!user) {
      user = await createUser(email, nameCompany, null, cccd);
    }

    const tokenResponse = await generateTrialToken(nameCompany, email, cccd);
    const tokenTrial = tokenResponse.tokenTrial || tokenResponse.token;
    const code = await createTrialCode(user.id, tokenTrial);

    await markTrialCodeReceived(user.id);

    await sendTrialCodeEmail({
      email: email,
      nameCompany: nameCompany,
      trialCode: code.code,
      expiryDate: new Date(
        Date.now() +
          (config.codes?.trial?.expiryDays || 15) * 24 * 60 * 60 * 1000
      ).toLocaleDateString("vi-VN"),
    });

    return res.status(200).json({
      success: true,
      message: "Code trial đã được gửi đến email của bạn!",
      trialCode: code.code,
      expiryDate: code.expires_at,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra khi tạo code trial. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
});

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
    return res.status(500).json({
      success: false,
      message: "Error checking callback status",
      error: error.message,
    });
  }
});

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
    return res.status(500).json({
      success: false,
      message: "Error checking code validity",
      error: error.message,
    });
  }
});

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
    return res.status(400).json({
      success: false,
      message: error.message || "Error deactivating code",
      error: error.message,
    });
  }
});

app.post("/api/request-premium", async (req, res) => {
  const { email, nameCompany, cccd } = req.body;

  if (!email || !nameCompany || !cccd) {
    return res.status(400).json({
      success: false,
      message: "Email, tên công ty và CCCD là bắt buộc",
    });
  }

  try {
    let user = await getUserByCCCD(cccd);

    if (!user) {
      user = await createUser(email, nameCompany, null, cccd);
    }

    const amount = config.payment.premiumPrice || 199000;
    const paymentRequest = generatePaymentRequest(
      urlCallbackRedirect,
      urlCallbackIpnUrl,
      amount
    );

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

    const response = await ApiPaymentAxios.post("/create", paymentRequest);

    if (!response.data || !response.data.payUrl) {
      throw new Error("MoMo payment URL not received");
    }

    return res.json({
      success: true,
      message: "Đang chuyển đến trang thanh toán...",
      paymentUrl: response.data.payUrl,
      orderId: paymentRequest.orderId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể tạo yêu cầu thanh toán. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
});

app.get("/callback-momo/redirect", async (req, res) => {
  const { orderId, resultCode, message, transId, amount } = req.query;

  try {
    const transaction = await getTransactionByOrderId(orderId);

    if (!transaction) {
      return res.redirect(
        `${ADMIN_PORTAL_URL}/payment-error?error=transaction_not_found`
      );
    }

    await updateTransactionStatus(orderId, "success", {
      transId,
      resultCode,
      message,
      testMode: true,
    });

    const paymentData = transaction.payment_data;

    const tokenResponse = await generatePremiumToken(
      paymentData.nameCompany,
      paymentData.email,
      paymentData.cccd
    );

    const tokenPremium = tokenResponse.tokenPremium || tokenResponse.token;
    const code = await createPremiumCode(transaction.user_id, tokenPremium);
    await linkCodeToTransaction(orderId, code.id);

    try {
      await sendPremiumCodeEmail({
        email: paymentData.email,
        nameCompany: paymentData.nameCompany,
        premiumCode: code.code,
        orderId: orderId,
        amount: amount,
        transactionDate: new Date().toLocaleString("vi-VN"),
      });
    } catch (emailError) {
      // Continue even if email fails
    }

    return res.redirect(
      `${ADMIN_PORTAL_URL}/payment-success?orderId=${orderId}&transId=${
        transId || "TEST"
      }&amount=${amount}&code=${code.code}`
    );
  } catch (error) {
    return res.redirect(
      `${ADMIN_PORTAL_URL}/payment-error?error=processing_error&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
});
