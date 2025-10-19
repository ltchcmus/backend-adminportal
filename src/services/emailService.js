import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../Configuration/configLoader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Read HTML template and replace placeholders
 */
const loadTemplate = (templatePath, replacements) => {
  try {
    const fullPath = path.join(
      __dirname,
      "..",
      templatePath.replace("./src/", "")
    );
    let template = fs.readFileSync(fullPath, "utf8");

    // Replace all placeholders {{key}} with values
    for (const [key, value] of Object.entries(replacements)) {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      template = template.replace(placeholder, value || "");
    }

    return template;
  } catch (error) {
    console.error("Error loading template:", error);
    throw error;
  }
};

/**
 * Send email via Brevo API
 */
export const sendEmail = async ({
  to,
  subject,
  htmlContent,
  toName = "User",
}) => {
  try {
    const emailData = {
      sender: {
        name: config.email.sender.name,
        email: config.email.sender.email,
      },
      to: [
        {
          email: to,
          name: toName,
        },
      ],
      subject: subject,
      htmlContent: htmlContent,
    };

    const response = await axios.post(config.email.apiUrl, emailData, {
      headers: {
        accept: "application/json",
        "api-key": config.email.apiKey,
        "content-type": "application/json",
      },
    });

    console.log(`✅ Email sent successfully to ${to}`);
    return {
      success: true,
      messageId: response.data.messageId,
      data: response.data,
    };
  } catch (error) {
    console.error(
      "❌ Error sending email:",
      error.response?.data || error.message
    );
    throw new Error(
      `Failed to send email: ${error.response?.data?.message || error.message}`
    );
  }
};

/**
 * Send trial code email
 */
export const sendTrialCodeEmail = async ({
  email,
  nameCompany,
  trialCode,
  expiryDate,
}) => {
  try {
    const downloadLink =
      config.server.adminPortalUrl || "https://myshop.vn/download";

    const htmlContent = loadTemplate(config.email.templates.trialCode, {
      nameCompany: nameCompany,
      email: email,
      trialCode: trialCode,
      expiryDate: expiryDate,
      downloadLink: downloadLink,
    });

    return await sendEmail({
      to: email,
      toName: nameCompany,
      subject: `🎁 Code Trial MyShop - Trải Nghiệm Miễn Phí 15 Ngày`,
      htmlContent: htmlContent,
    });
  } catch (error) {
    console.error("Error sending trial code email:", error);
    throw error;
  }
};

/**
 * Send premium code email
 */
export const sendPremiumCodeEmail = async ({
  email,
  nameCompany,
  premiumCode,
  orderId,
  amount,
  transactionDate,
}) => {
  try {
    const downloadLink =
      config.server.adminPortalUrl || "https://myshop.vn/download";

    const htmlContent = loadTemplate(config.email.templates.premiumCode, {
      nameCompany: nameCompany,
      email: email,
      premiumCode: premiumCode,
      orderId: orderId,
      amount: new Intl.NumberFormat("vi-VN").format(amount),
      transactionDate: transactionDate,
      downloadLink: downloadLink,
    });

    return await sendEmail({
      to: email,
      toName: nameCompany,
      subject: `🎉 Code Premium MyShop - Kích Hoạt Thành Công`,
      htmlContent: htmlContent,
    });
  } catch (error) {
    console.error("Error sending premium code email:", error);
    throw error;
  }
};

/**
 * Send test email (for debugging)
 */
export const sendTestEmail = async (toEmail) => {
  try {
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #1e40af;">Test Email từ MyShop Admin Portal</h2>
          <p>Email service đang hoạt động bình thường!</p>
          <p>Thời gian: ${new Date().toLocaleString("vi-VN")}</p>
        </body>
      </html>
    `;

    return await sendEmail({
      to: toEmail,
      toName: "Tester",
      subject: "🧪 Test Email - MyShop Admin Portal",
      htmlContent: htmlContent,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    throw error;
  }
};

export default {
  sendEmail,
  sendTrialCodeEmail,
  sendPremiumCodeEmail,
  sendTestEmail,
};
