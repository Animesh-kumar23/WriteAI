const { redisClient } = require("../configs/redis");
const ENV = require("../configs/env");

async function checkAIDailyQuota(req, res, next) {
  if (!redisClient) {
    return next();
  }

  const today = new Date().toISOString().slice(0, 10);
  const key = `ai:daily:${req.user.id}:${today}`;

  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const ttl = Math.ceil((midnight - now) / 1000);

  try {
    const count = await redisClient.incr(key);

    if (count === 1) {
      await redisClient.expire(key, ttl);
    }

    if (count > ENV.AI_DAILY_LIMIT) {
      await redisClient.decr(key);
      return res.status(429).json({
        reason: "daily_limit_exceeded",
        resetAt: midnight.toISOString(),
        limit: ENV.AI_DAILY_LIMIT,
      });
    }

    res.setHeader("X-AI-Requests-Today", count);
    res.setHeader("X-AI-Daily-Limit", ENV.AI_DAILY_LIMIT);

    return next();
  } catch {
    // Redis error — degrade gracefully
    return next();
  }
}

module.exports = { checkAIDailyQuota };
