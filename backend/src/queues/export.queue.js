const { Queue } = require("bullmq");
const { bullmqConnection } = require("../configs/redis");
const ENV = require("../configs/env");

const isTest = ENV.NODE_ENV === "test";
const EXPORT_QUEUE_NAME = isTest ? "writeai-test-exports" : "exports";
const EXPORT_QUEUE_PREFIX = isTest ? "writeai-test" : "bull";

const exportQueue = bullmqConnection
  ? new Queue(EXPORT_QUEUE_NAME, {
      connection: bullmqConnection,
      prefix: EXPORT_QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 50 },
      },
    })
  : null;

module.exports = { exportQueue, EXPORT_QUEUE_NAME, EXPORT_QUEUE_PREFIX };
