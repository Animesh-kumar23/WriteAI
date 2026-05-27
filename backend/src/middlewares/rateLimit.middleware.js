const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redisClient } = require("../configs/redis");

let _globalLimiter = null;
let _authLimiter = null;
let _aiLimiter = null;
let _exportLimiter = null;

function makeStore(prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix,
  });
}

// Called from startServer() after connectToRedis() so the async Redis init
// (PING handshake) completes before app.listen() — avoids ERR_CONNECTION_RESET
// on the very first request.
async function initLimiters() {
  _globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    store: makeStore("rl_global:"),
  });

  _authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts, try again in 15 minutes." },
    store: makeStore("rl_auth:"),
  });

  _aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user.id,
    message: { error: "AI generation limit reached, try again in an hour." },
    store: makeStore("rl_ai:"),
  });

  _exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user.id,
    message: { error: "Export limit reached, try again in an hour." },
    store: makeStore("rl_export:"),
  });
}

// Wrapper middlewares — fail open if called before initLimiters() runs
const globalLimiter = (req, res, next) =>
  _globalLimiter ? _globalLimiter(req, res, next) : next();
const authLimiter = (req, res, next) =>
  _authLimiter ? _authLimiter(req, res, next) : next();
const aiLimiter = (req, res, next) =>
  _aiLimiter ? _aiLimiter(req, res, next) : next();
const exportLimiter = (req, res, next) =>
  _exportLimiter ? _exportLimiter(req, res, next) : next();

module.exports = { initLimiters, globalLimiter, authLimiter, aiLimiter, exportLimiter };
