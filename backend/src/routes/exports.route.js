const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  requestExport,
  getExportStatus,
  downloadExport,
  getExportStats,
} = require("../controllers/exports.controller");

router.use(authenticate);

// Queue health stats — must be before /status/:jobId to avoid "stats" matching :jobId
router.get("/stats", getExportStats);

// Enqueue an export job
router.post("/:documentId/:format", requestExport);

// Poll job status
router.get("/status/:jobId", getExportStatus);

// Download completed export
router.get("/download/:jobId", downloadExport);

module.exports = router;
