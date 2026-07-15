const { createClient } = require("redis");
const ENV = require("./env");

const redisClient = ENV.REDIS_URL
  ? createClient({
      url: ENV.REDIS_URL,
      // Fail fast instead of queueing commands indefinitely while the socket
      // is down/reconnecting — callers already catch and fail open, but only
      // if the command rejects rather than hanging forever.
      disableOfflineQueue: true,
    })
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

const CONNECT_TIMEOUT_MS = 5000;

async function connectToRedis() {
  if (!redisClient) {
    console.warn("REDIS_URL not set — rate limiting will use in-memory store");
    return;
  }

  // redis's default reconnectStrategy retries forever on a refused connection
  // (it never rejects on its own), so an unreachable Redis at boot would hang
  // startup indefinitely without this race. The client keeps retrying in the
  // background either way — it'll pick up automatically once Redis is back.
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("connection timed out")), CONNECT_TIMEOUT_MS)
      ),
    ]);
    console.log("Connected to Redis");
  } catch (error) {
    console.warn(
      `Redis unavailable at startup (${error.message}) — starting without it; Redis-backed features will degrade until it connects`
    );
  }
}

module.exports = { redisClient, bullmqConnection, connectToRedis };
