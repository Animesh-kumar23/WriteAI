require("dotenv").config();
const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? 3000,
  DB_URI: process.env.DB_URI ?? "",
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ?? "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5173",
  REDIS_URL: process.env.REDIS_URL ?? "",
  AI_DAILY_LIMIT: parseInt(process.env.AI_DAILY_LIMIT ?? "100", 10),
  ATLAS_SEARCH_ENABLED: process.env.ATLAS_SEARCH_ENABLED === "true",
};
if (!ENV.JWT_SECRET_KEY) {
  throw new Error("JWT_SECRET_KEY missing!");
}

module.exports = ENV;
