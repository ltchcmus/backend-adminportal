// Test MoMo IPN Endpoint
// Chạy: node test-ipn.js

const testIPN = async () => {
  try {
    console.log("🧪 Testing MoMo IPN Endpoint...\n");

    const testData = {
      orderId: "TEST_" + Date.now(),
      resultCode: 0,
      message: "Successful",
      transId: "TEST_TRANS_" + Date.now(),
      amount: 199000,
    };

    console.log("📋 Test Data:");
    console.log(JSON.stringify(testData, null, 2));
    console.log("");

    console.log("📡 Sending POST request to IPN endpoint...");
    const response = await fetch(
      "http://localhost:3000/callback-momo/ipn-url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      }
    );

    console.log("📊 Response Status:", response.status);
    console.log("📊 Response Status Text:", response.statusText);
    console.log("");

    const result = await response.json();
    console.log("✅ Response Data:");
    console.log(JSON.stringify(result, null, 2));

    if (result.status === "success") {
      console.log("\n✅ IPN Test Successful!");
      console.log(`💎 Premium Code: ${result.code}`);
      console.log(`📦 Order ID: ${result.orderId}`);
    } else {
      console.log("\n❌ IPN Test Failed!");
      console.log("Error:", result.message);
    }
  } catch (error) {
    console.error("\n❌ Test Error:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
};

testIPN();
