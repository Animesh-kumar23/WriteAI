const { Worker } = require("bullmq");
const { bullmqConnection } = require("../configs/redis");
const { generatePdfBuffer } = require("../utils/pdf.generator");
const { getFullDocumentContent } = require("../utils/documentChunks");
const Document = require("../models/document");
const { EXPORT_QUEUE_NAME, EXPORT_QUEUE_PREFIX } = require("../queues/export.queue");

function createExportWorker() {
  const worker = new Worker(
    EXPORT_QUEUE_NAME,
    async (job) => {
      const { documentId, format } = job.data;

      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      const content = await getFullDocumentContent(document._id);
      const exportDoc = {
        title: document.title,
        subtitle: document.subtitle,
        coverImage: document.coverImage,
        content,
      };

      const safeName = document.title.replace(/[^a-zA-Z0-9]/g, "_");
      const buffer = await generatePdfBuffer(exportDoc);
      const contentType = "application/pdf";
      const filename = `${safeName}.pdf`;

      return { filename, contentType, data: buffer.toString("base64") };
    },
    { connection: bullmqConnection, prefix: EXPORT_QUEUE_PREFIX }
  );

  worker.on("failed", (job, err) => {
    console.error("Export job failed", {
      jobId: job?.id,
      documentId: job?.data?.documentId,
      format: job?.data?.format,
      error: err.message,
    });
  });

  return worker;
}

module.exports = { createExportWorker };
