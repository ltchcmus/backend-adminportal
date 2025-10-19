import axios from "axios";
import crypto from "crypto";
import config from "../Configuration/configLoader.js";

/**
 * Generate test code (fallback when external API is not configured)
 * Format: TRL-XXXX-XXXX or PRM-XXXX-XXXX (shorter for database compatibility)
 */
const generateTestCode = (type = "trial") => {
  const prefix = type === "trial" ? "TRL" : "PRM";
  const segments = [];

  // Generate 3 segments of 4 characters each
  for (let i = 0; i < 3; i++) {
    segments.push(crypto.randomBytes(2).toString("hex").toUpperCase());
  }

  // Result: TRL-A1B2-C3D4-E5F6 (19 chars) or PRM-A1B2-C3D4-E5F6 (19 chars)
  return `${prefix}-${segments.join("-")}`;
};

/**
 * Call external API to generate trial token
 */
export const generateTrialToken = async (nameCompany, email, cccd) => {
  try {
    // Check if external API is configured
    const hasExternalApi =
      config.externalApi?.baseUrl && config.externalApi.baseUrl.trim() !== "";

    if (!hasExternalApi) {
      console.log("⚠️ External API not configured, using test code generator");
      const testCode = generateTestCode("trial");
      return {
        success: true,
        tokenTrial: testCode,
        source: "test-generator",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
    }

    // Call external API
    const url =
      config.externalApi.baseUrl +
      config.externalApi.generateTrialTokenEndpoint;

    console.log(`🔄 Calling external API for trial token: ${url}`);

    const response = await axios.post(
      url,
      {
        nameCompany: nameCompany,
        email: email,
        cccd: cccd,
        type: "trial",
      },
      {
        timeout: config.externalApi.timeout || 5000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (
      response.data &&
      response.data.result &&
      response.data.result.tokenTrial
    ) {
      console.log("✅ Trial token generated from external API");
      return {
        success: true,
        tokenTrial: response.data.result.tokenTrial,
        source: "external-api",
        expiresAt:
          response.data.result.expiresAt ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    } else {
      throw new Error("Invalid response format from external API");
    }
  } catch (error) {
    console.error(
      "❌ Error calling external API for trial token:",
      error.message
    );

    // Fallback to test generator
    console.log("⚠️ Falling back to test code generator");
    const testCode = generateTestCode("trial");
    return {
      success: true,
      tokenTrial: testCode,
      source: "test-generator-fallback",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      error: error.message,
    };
  }
};

/**
 * Call external API to generate premium token
 */
export const generatePremiumToken = async (nameCompany, email, cccd) => {
  try {
    // Check if external API is configured
    const hasExternalApi =
      config.externalApi?.baseUrl && config.externalApi.baseUrl.trim() !== "";

    if (!hasExternalApi) {
      console.log("⚠️ External API not configured, using test code generator");
      const testCode = generateTestCode("premium");
      return {
        success: true,
        tokenPremium: testCode,
        source: "test-generator",
        expiresAt: null, // Premium never expires
      };
    }

    // Call external API
    const url =
      config.externalApi.baseUrl +
      config.externalApi.generatePremiumTokenEndpoint;

    console.log(`🔄 Calling external API for premium token: ${url}`);

    const response = await axios.post(
      url,
      {
        nameCompany: nameCompany,
        email: email,
        cccd: cccd,
        type: "premium",
      },
      {
        timeout: config.externalApi.timeout || 5000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (
      response.data &&
      response.data.result &&
      response.data.result.tokenPremium
    ) {
      console.log("✅ Premium token generated from external API");
      return {
        success: true,
        tokenPremium: response.data.result.tokenPremium,
        source: "external-api",
        expiresAt: null, // Premium never expires
      };
    } else {
      throw new Error("Invalid response format from external API");
    }
  } catch (error) {
    console.error(
      "❌ Error calling external API for premium token:",
      error.message
    );

    // Fallback to test generator
    console.log("⚠️ Falling back to test code generator");
    const testCode = generateTestCode("premium");
    return {
      success: true,
      tokenPremium: testCode,
      source: "test-generator-fallback",
      expiresAt: null,
      error: error.message,
    };
  }
};

/**
 * Validate token with external API (optional)
 */
export const validateToken = async (token, type = "trial") => {
  try {
    const hasExternalApi =
      config.externalApi?.baseUrl && config.externalApi.baseUrl.trim() !== "";

    if (!hasExternalApi) {
      console.log("⚠️ External API not configured, skipping validation");
      return {
        success: true,
        valid: true,
        source: "no-validation",
      };
    }

    const url =
      config.externalApi.baseUrl + config.externalApi.validateTokenEndpoint;

    const response = await axios.post(
      url,
      {
        token: token,
        type: type,
      },
      {
        timeout: config.externalApi.timeout || 5000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      valid: response.data.valid || false,
      data: response.data,
    };
  } catch (error) {
    console.error("❌ Error validating token:", error.message);
    return {
      success: false,
      valid: false,
      error: error.message,
    };
  }
};

export default {
  generateTrialToken,
  generatePremiumToken,
  validateToken,
  generateTestCode,
};
