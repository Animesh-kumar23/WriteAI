const { Worker } = require("bullmq");
const { bullmqConnection, redisClient } = require("../configs/redis");
const { generatePdfBuffer } = require("../utils/pdf.generator");
const { generateDocx } = require("../utils/docx.generator");
const { getFullDocumentContent } = require("../utils/documentChunks");
const Document = require("../models/document");
const { EXPORT_QUEUE_NAME, EXPORT_QUEUE_PREFIX } = require("../queues/export.queue");

const RESULT_TTL_SECONDS = 30 * 60; // 30 minutes — long enough for users who walk away mid-export

function createExportWorker() {
  if (!bullmqConnection) return null;

  const worker = new Worker(
    EXPORT_QUEUE_NAME,
    async (job) => {
      const { documentId, format } = job.data;

      const document = await Document.findById(documentId);
      if (!document) {
        // Permanent failure — no point retrying if the document doesn't exist
        const err = new Error(`PERMANENT: Document ${documentId} not found`);
        err.permanent = true;
        throw err;
      }

      const content = await getFullDocumentContent(document._id);
      const exportDoc = {
        title: document.title,
        subtitle: document.subtitle,
        coverImage: document.coverImage,
        content,
      };

      const safeName = document.title.replace(/[^a-zA-Z0-9]/g, "_");
      let buffer, contentType, filename;

      if (format === "pdf") {
        buffer = await generatePdfBuffer(exportDoc);
        contentType = "application/pdf";
        filename = `${safeName}.pdf`;
      } else {
        buffer = await generateDocx(exportDoc);
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        filename = `${safeName}.docx`;
      }

      await redisClient.set(`export:${job.id}`, buffer.toString("base64"), {
        EX: RESULT_TTL_SECONDS,
      });
      await redisClient.set(
        `export:meta:${job.id}`,
        JSON.stringify({ filename, contentType }),
        { EX: RESULT_TTL_SECONDS }
      );

      return { filename, contentType };
    },
    { connection: bullmqConnection, prefix: EXPORT_QUEUE_PREFIX }
  );

  worker.on("failed", (job, err) => {
    console.error("Export job failed", {
      jobId: job?.id,
      documentId: job?.data?.documentId,
      format: job?.data?.format,
      attempt: `${job?.attemptsMade}/${job?.opts?.attempts}`,
      error: err.message,
      permanent: err.permanent ?? false,
    });
  });

  worker.on("stalled", (jobId) => {
    console.warn("Export job stalled — will be retried:", jobId);
  });

  return worker;
}

module.exports = { createExportWorker };
