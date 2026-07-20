const { createClient } = require("redis");
const ENV = require("./env");

const redisClient = ENV.REDIS_URL
  ? createClient({ url: ENV.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on("error", (err) => console.error("Redis client error:", err));
}

// ioredis-compatible connection options for BullMQ
// BullMQ does not use node-redis; pass this object to Queue/Worker instead
const bullmqConnection = ENV.REDIS_URL
  ? (() => {
      const url = new URL(ENV.REDIS_URL);
      const database = url.pathname.length > 1
        ? parseInt(url.pathname.slice(1), 10)
        : undefined;
      return {
        host: url.hostname,
        port: parseInt(url.port, 10),
        username: url.username || undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        db: Number.isInteger(database) ? database : undefined,
        tls: url.protocol === "rediss:" ? {} : undefined,
      };
    })()
  : null;

async function connectToRedis() {
  if (!redisClient) {
    console.warn("REDIS_URL not set — rate limiting will use in-memory store");
    return;
  }

  await redisClient.connect();
  console.log("Connected to Redis");
}

module.exports = { redisClient, bullmqConnection, connectToRedis };
