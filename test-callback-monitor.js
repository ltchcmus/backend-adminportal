// Monitor MoMo callback status
// Chạy: node test-timeout.js

const monitorCallback = async () => {
  try {
    console.log("🧪 Testing MoMo Callback Monitoring...\n");

    const testData = {
      email: "test@example.com",
      nameCompany: "Test Company",
      cccd: "123456789012",
    };

    console.log("📋 Step 1: Creating premium payment request...");
    const response = await fetch("http://localhost:3000/api/request-premium", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    console.log("✅ Payment request created:");
    console.log(`📦 Order ID: ${result.orderId}`);
    console.log(` Payment URL: ${result.payUrl?.substring(0, 60)}...`);

    console.log("\n� Step 2: Monitoring callback status...");
    console.log("💡 Now:");
    console.log("   1. Go to payment URL and pay/cancel");
    console.log("   2. Watch this script monitor callback status");
    console.log("   3. See if MoMo sends callback to backend\n");

    // Monitor every 10 seconds for 5 minutes
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes

    const checkStatus = async () => {
      attempts++;
      try {
        const statusResponse = await fetch(`http://localhost:3000/api/callback/status/${result.orderId}`);
        const status = await statusResponse.json();

        console.log(`⏰ Check #${attempts} (${new Date().toLocaleTimeString()}):`);
        
        if (status.success) {
          console.log(`   📊 Callback Status: ${status.callbackReceived ? '✅ RECEIVED' : '❌ NOT RECEIVED'}`);
          console.log(`   📋 Transaction Status: ${status.status}`);
          console.log(`   🕐 Created: ${new Date(status.createdAt).toLocaleTimeString()}`);
          console.log(`   🕐 Updated: ${new Date(status.updatedAt).toLocaleTimeString()}`);
          
          if (status.callbackReceived) {
            console.log(`\n🎉 SUCCESS! Callback received!`);
            console.log(`📋 Details:`, status.details);
            console.log(`\n✅ Check backend logs for:`);
            console.log(`   � MOMO CALLBACK RECEIVED (GET REDIRECT)`);
            console.log(`   🔵 MOMO IPN CALLBACK RECEIVED (POST)`);
            console.log(`   📧 Premium email sending logs`);
            return;
          }
        } else {
          console.log(`   ❌ Status: ${status.message}`);
        }

        if (attempts >= maxAttempts) {
          console.log(`\n⏰ Monitoring finished after ${maxAttempts} attempts.`);
          console.log(`❌ No callback received - this means:`);
          console.log(`   1. User didn't complete payment`);
          console.log(`   2. Or MoMo didn't send callback (rare)`);
          console.log(`   3. Or callback URL is wrong`);
          console.log(`\n💡 No premium code will be created (as expected).`);
          return;
        }

        setTimeout(checkStatus, 10000); // Check again in 10 seconds
      } catch (error) {
        console.error(`❌ Error checking status:`, error.message);
        setTimeout(checkStatus, 10000);
      }
    };

    setTimeout(checkStatus, 5000); // Start checking after 5 seconds

  } catch (error) {
    console.error("\n❌ Test Error:");
    console.error("Error message:", error.message);
  }
};

monitorCallback();