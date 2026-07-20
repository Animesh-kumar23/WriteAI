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
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
};
const REQUIRED = ["DB_URI", "JWT_SECRET_KEY", "GEMINI_API_KEY", "REDIS_URL"];
const missing = REQUIRED.filter((k) => !ENV[k]);
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

module.exports = ENV;
