const app = require("./app");
const ENV = require("./configs/env");
const { connectToDB } = require("./configs/db");
const { connectToRedis } = require("./configs/redis");
const { createExportWorker } = require("./workers/export.worker");
const { initLimiters } = require("./middlewares/rateLimit.middleware");

async function startServer() {
  await connectToDB();
  await connectToRedis();
  await initLimiters();

  const exportWorker = createExportWorker();
  if (exportWorker) console.log("Export worker started");

  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
    console.log(`Environment: ${ENV.NODE_ENV}`);
  });
}

(async () => {
  try {
    await startServer();
  } catch (error) {
    console.error("Error starting the server:", error);
    process.exitCode = 1;
  }
})();
