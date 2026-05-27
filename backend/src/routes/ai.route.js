const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { aiLimiter } = require("../middlewares/rateLimit.middleware");
const { checkAIDailyQuota } = require("../middlewares/aiQuota.middleware");

const {
  generateDocumentContent,
  streamAIContent,
} = require("../controllers/ai.controller");

router.use(authenticate);

router.post("/generate-content", aiLimiter, checkAIDailyQuota, generateDocumentContent);
router.post("/stream", aiLimiter, checkAIDailyQuota, streamAIContent);

module.exports = router;