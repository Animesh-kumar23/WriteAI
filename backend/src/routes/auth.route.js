const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimit.middleware");
const {
  registerUser,
  signInUser,
  logoutUser,
  getMe,
} = require("../controllers/auth.controller");

router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, signInUser);
router.post("/logout", logoutUser);
router.get("/me", authenticate, getMe);

module.exports = router;
