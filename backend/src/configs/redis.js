const { createClient } = require("redis");
const ENV = require("./env");

const REDIS_STARTUP_TIMEOUT_MS = 5000;
const redisClient = createClient({ url: ENV.REDIS_URL });

redisClient.on("error", (err) => console.error("Redis client error:", err));

// ioredis-compatible connection options for BullMQ
// BullMQ does not use node-redis; pass this object to Queue/Worker instead
const redisUrl = new URL(ENV.REDIS_URL);
const database = redisUrl.pathname.length > 1
  ? parseInt(redisUrl.pathname.slice(1), 10)
  : undefined;
const bullmqConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10),
  username: redisUrl.username || undefined,
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  db: Number.isInteger(database) ? database : undefined,
  tls: redisUrl.protocol === "rediss:" ? {} : undefined,
};

async function connectToRedis() {
  let timeoutId;
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Redis connection timed out after ${REDIS_STARTUP_TIMEOUT_MS}ms`));
        }, REDIS_STARTUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
  console.log("Connected to Redis");
}

module.exports = { redisClient, bullmqConnection, connectToRedis };
