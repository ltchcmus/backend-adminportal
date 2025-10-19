import { sendPremiumCodeEmail } from "./src/services/emailService.js";
import { loadConfig } from "./src/Configuration/configLoader.js";

// Test sending premium email
async function testPremiumEmail() {
  try {
    console.log("🧪 Testing premium email sending...\n");

    // Load config
    const config = loadConfig();
    console.log("📋 Email Config:");
    console.log("  - API Key:", config.email.apiKey ? "✅ Set" : "❌ Missing");
    console.log("  - API URL:", config.email.apiUrl);
    console.log("  - Sender:", config.email.sender.email);
    console.log("  - Template Path:", config.email.templates.premiumCode);
    console.log("");

    // Test data
    const testData = {
      email: "mailtacvu05@gmail.com", // Email của sender (để test)
      nameCompany: "Test Company",
      premiumCode: "PRM-TEST-1234-5678",
      orderId: "TEST_ORDER_123",
      amount: 50000,
      transactionDate: new Date().toLocaleString("vi-VN"),
    };

    console.log("📧 Sending test email to:", testData.email);
    console.log("📝 Email data:", testData);
    console.log("");

    const result = await sendPremiumCodeEmail(testData);

    console.log("\n✅ Email sent successfully!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ Error sending email:");
    console.error("Error message:", error.message);

    if (error.response) {
      console.error("\n📡 API Response:");
      console.error("  - Status:", error.response.status);
      console.error("  - Data:", JSON.stringify(error.response.data, null, 2));
    }

    console.error("\n🔍 Full error stack:");
    console.error(error.stack);
  }
}

testPremiumEmail();
