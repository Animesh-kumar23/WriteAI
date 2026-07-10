const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 10000,
    env: {
      NODE_ENV: "test",
      DB_URI: "mongodb://127.0.0.1:27017/writeai_test",
      REDIS_URL: "redis://127.0.0.1:6379/15",
      JWT_SECRET_KEY: "writeai-test-secret-not-for-production",
      GEMINI_API_KEY: "writeai-test-key-no-api-calls",
      CLIENT_URL: "http://localhost:5173",
      AI_DAILY_LIMIT: "1",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.js"],
      exclude: ["src/server.js", "src/scripts/**"],
    },
  },
});
