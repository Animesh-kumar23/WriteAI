const Document = require("../models/document");
const { exportQueue } = require("../queues/export.queue");
const { redisClient } = require("../configs/redis");

const VALID_FORMATS = new Set(["pdf", "docx"]);

async function requestExport(req, res) {
  try {
    const { documentId, format } = req.params;

    if (!VALID_FORMATS.has(format)) {
      return res.status(400).json({ error: "Format must be pdf or docx" });
    }

    if (!exportQueue) {
      return res.status(503).json({ error: "Export queue unavailable" });
    }

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found!" });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const job = await exportQueue.add("export", {
      documentId,
      format,
      userId: req.user.id.toString(),
    });

    res.status(202).json({ jobId: job.id });
  } catch (error) {
    console.error("requestExport error:", error);
    res.status(500).json({ error: "Failed to queue export job." });
  }
}

async function getExportStatus(req, res) {
  try {
    const { jobId } = req.params;

    if (!exportQueue) {
      return res.status(503).json({ error: "Export queue unavailable" });
    }

    const job = await exportQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.data.userId !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const state = await job.getState();

    if (state === "completed") {
      const metaRaw = await redisClient.get(`export:meta:${jobId}`);
      if (!metaRaw) {
        return res.status(410).json({ error: "Export expired, please re-export" });
      }
      const { filename, contentType } = JSON.parse(metaRaw);
      return res.json({ status: "completed", filename, contentType });
    }

    if (state === "failed") {
      return res.json({ status: "failed", error: job.failedReason });
    }

    res.json({ status: state });
  } catch (error) {
    console.error("getExportStatus error:", error);
    res.status(500).json({ error: "Failed to retrieve export status." });
  }
}

async function downloadExport(req, res) {
  try {
    const { jobId } = req.params;

    if (!exportQueue) {
      return res.status(503).json({ error: "Export queue unavailable" });
    }

    const job = await exportQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.data.userId !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const state = await job.getState();
    if (state !== "completed") {
      return res.status(400).json({ error: `Export not ready (${state})` });
    }

    const [base64, metaRaw] = await Promise.all([
      redisClient.get(`export:${jobId}`),
      redisClient.get(`export:meta:${jobId}`),
    ]);

    if (!base64 || !metaRaw) {
      return res.status(410).json({ error: "Export expired, please re-export" });
    }

    const { filename, contentType } = JSON.parse(metaRaw);
    const buffer = Buffer.from(base64, "base64");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Transfer-Encoding", "binary");
    res.setHeader("Cache-Control", "no-cache");

    res.send(buffer);
  } catch (error) {
    console.error("downloadExport error:", error);
    res.status(500).json({ error: "Failed to download export." });
  }
}

async function getExportStats(req, res) {
  if (!exportQueue) {
    return res.status(503).json({ error: "Export queue unavailable" });
  }

  const [waiting, active, completed, failed] = await Promise.all([
    exportQueue.getWaitingCount(),
    exportQueue.getActiveCount(),
    exportQueue.getCompletedCount(),
    exportQueue.getFailedCount(),
  ]);

  return res.json({ waiting, active, completed, failed });
}

module.exports = { requestExport, getExportStatus, downloadExport, getExportStats };
