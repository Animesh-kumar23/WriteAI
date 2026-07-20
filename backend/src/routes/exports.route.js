const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  requestExport,
  getExportStatus,
  downloadExport,
} = require("../controllers/exports.controller");

router.use(authenticate);

// Enqueue an export job
router.post("/:documentId/:format", requestExport);

// Poll job status
router.get("/status/:jobId", getExportStatus);

// Download completed export
router.get("/download/:jobId", downloadExport);

module.exports = router;
