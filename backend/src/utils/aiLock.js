const crypto = require("crypto");
const { redisClient } = require("../configs/redis");

const LOCK_TTL_SECONDS = 180; // covers retrieval + generation, not just generation

// Only delete the key if its value still matches the token we set — prevents a
// slow request from deleting a DIFFERENT request's lock after its own TTL
// expired and someone else acquired the key in the meantime.
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
  if (!redisClient) return { acquired: true, lockKey, token: null }; // graceful degradation, same as today

  const token = crypto.randomUUID(); // unique per acquisition — this is what makes the compare-and-delete release safe
  try {
    const acquired = await redisClient.set(lockKey, token, { EX: LOCK_TTL_SECONDS, NX: true });
    return acquired ? { acquired: true, lockKey, token } : { acquired: false, lockKey, token: null };
  } catch {
    return { acquired: true, lockKey, token: null }; // Redis hiccup — fail open, same as today
  }
}

async function releaseAILock(lockKey, token) {
  if (!redisClient || !token) return;
  try {
    await redisClient.eval(RELEASE_SCRIPT, { keys: [lockKey], arguments: [token] });
  } catch {
    // best-effort — the TTL still expires the key on its own
  }
}

module.exports = { acquireAILock, releaseAILock, lockKeyFor };
