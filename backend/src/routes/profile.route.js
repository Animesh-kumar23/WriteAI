const router = require("express").Router();
const {
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar,
} = require("../controllers/profile.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  uploadAvatarImage,
  verifyImageSignature,
} = require("../middlewares/upload.middleware");

router.get("/", authenticate, getProfile);
router.put("/", authenticate, updateProfile);

router.put(
  "/avatar",
  authenticate,
  uploadAvatarImage,
  verifyImageSignature,
  updateAvatar
);
router.delete("/avatar", authenticate, deleteAvatar);

module.exports = router;
