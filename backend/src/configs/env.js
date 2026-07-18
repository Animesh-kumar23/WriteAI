require("dotenv").config();
const nodeEnv = process.env.NODE_ENV ?? "development";
const ENV = {
  NODE_ENV: nodeEnv,
  PORT: process.env.PORT ?? 3000,
  // Auth cookies are marked Secure (HTTPS-only) in production by default.
  // Set COOKIE_SECURE=false to allow login over plain HTTP (e.g. a demo box
  // reached via http://<ip> with no TLS in front of it).
  COOKIE_SECURE:
    process.env.COOKIE_SECURE != null
      ? process.env.COOKIE_SECURE === "true"
      : nodeEnv === "production",
  DB_URI: process.env.DB_URI ?? "",
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ?? "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5173",
  REDIS_URL: process.env.REDIS_URL ?? "",
  AI_DAILY_LIMIT: parseInt(process.env.AI_DAILY_LIMIT ?? "100", 10),
  ATLAS_SEARCH_ENABLED: process.env.ATLAS_SEARCH_ENABLED === "true",
  RAG_ENABLED: process.env.RAG_ENABLED === "true", // default OFF — must be explicitly opted into
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
};
const REQUIRED = ["DB_URI", "JWT_SECRET_KEY", "GEMINI_API_KEY"];
const missing = REQUIRED.filter((k) => !ENV[k]);
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

module.exports = ENV;
