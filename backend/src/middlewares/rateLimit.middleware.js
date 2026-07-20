const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redisClient } = require("../configs/redis");

function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix,
  });
}

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    store: makeStore("rl_global:"),
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts, try again in 15 minutes." },
    store: makeStore("rl_auth:"),
});

const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    // These limiters run only on authenticated routes, so req.user is always set.
    // The req.ip fallback is a safety net for mis-ordered middleware, not normal
    // traffic — suppress the IPv6 warning since it won't be hit in practice.
    keyGenerator: (req) => req.user?.id ?? req.ip,
    validate: { keyGeneratorIpFallback: false },
    message: { error: "AI generation limit reached, try again in an hour." },
    store: makeStore("rl_ai:"),
});

const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip,
    validate: { keyGeneratorIpFallback: false },
    message: { error: "Export limit reached, try again in an hour." },
    store: makeStore("rl_export:"),
});

module.exports = { globalLimiter, authLimiter, aiLimiter, exportLimiter };
