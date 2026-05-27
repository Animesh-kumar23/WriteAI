const { Queue } = require("bullmq");
const { bullmqConnection } = require("../configs/redis");

const exportQueue = bullmqConnection
  ? new Queue("exports", {
      connection: bullmqConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 50 },
      },
    })
  : null;

module.exports = { exportQueue };
