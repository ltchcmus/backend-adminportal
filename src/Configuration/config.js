import axios from "axios";

export const API_SERVER = "http://localhost:5228/api/v1";

export const API_GENERATE_TOKEN = "/api/v1/auth/generate-token";
export const API_VALIDATE_TOKEN = "/api/v1/auth/validate-token";
export const API_SAVE_USER = "/api/v1/users/save";

export const API_PAYMENT_MOMO = "https://test-payment.momo.vn/v2/gateway/api";

// Email secret key is now loaded from environment variables via config.yaml
// export const EMAIL_SECRET_KEY = ""; // REMOVED FOR SECURITY

export const ApiPaymentAxios = axios.create({
  baseURL: API_PAYMENT_MOMO,
  headers: {
    "Content-type": "application/json",
  },
});

export const ApiAuthAxios = axios.create({
  baseURL: API_SERVER + "/auth",
  headers: {
    "Content-type": "application/json",
  },
});

export const ApiUserAxios = axios.create({
  baseURL: API_SERVER + "/users",
  headers: {
    "Content-type": "application/json",
  },
});
