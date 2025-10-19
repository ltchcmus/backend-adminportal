import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Load environment variables first
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config.yaml
const configPath = path.join(__dirname, "../../config.yaml");
const configFile = fs.readFileSync(configPath, "utf8");
const config = yaml.load(configFile);

// Helper function to replace placeholders
const replacePlaceholders = (obj, context = config) => {
  if (typeof obj === "string") {
    // Replace ${variable.path} with actual values from config or environment
    return obj.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const keys = path.split(".");
      let value = context;
      
      // First try to get from config
      for (const key of keys) {
        value = value?.[key];
      }
      
      // If not found in config, try environment variables
      if (value === undefined) {
        value = process.env[path];
      }
      
      return value !== undefined ? value : match;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => replacePlaceholders(item, context));
  }

  if (typeof obj === "object" && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replacePlaceholders(value, context);
    }
    return result;
  }

  return obj;
};

// Process config with placeholder replacement
const processedConfig = replacePlaceholders(config);

// Export both default and named export
export default processedConfig;
export const loadConfig = () => processedConfig;
