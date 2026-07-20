const crypto = require("crypto");
const { redisClient } = require("../configs/redis");

const LOCK_TTL_SECONDS = 180; // covers retrieval + generation, not just generation

// Deliberately retained during scope reduction: tokenized compare-and-delete
// prevents a slow request from releasing a newer request's lock.
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

function lockKeyFor(userId, documentId) {
  return documentId ? `ai:lock:${userId}:${documentId}` : `ai:lock:${userId}`;
}

async function acquireAILock(userId, documentId) {
  const lockKey = lockKeyFor(userId, documentId);
  const token = crypto.randomUUID();
  const acquired = await redisClient.set(lockKey, token, { EX: LOCK_TTL_SECONDS, NX: true });
  return acquired ? { acquired: true, lockKey, token } : { acquired: false, lockKey, token: null };
}

async function releaseAILock(lockKey, token) {
  await redisClient.eval(RELEASE_SCRIPT, { keys: [lockKey], arguments: [token] });
}

module.exports = { acquireAILock, releaseAILock, lockKeyFor };
