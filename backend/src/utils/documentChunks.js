const DocumentChunk = require("../models/DocumentChunk");
const Document = require("../models/document");
const chunkLimits = require("../../../config/chunkLimits.json");

const CHUNK_SIZE = chunkLimits.targetChunkCharacters;

function countWords(text = "") {
  if (!text) return 0;
  const stripped = String(text).replace(/<[^>]*>/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
}

async function recomputeDocumentWordCount(documentId) {
  const chunks = await DocumentChunk.find(
    { documentId },
    { content: 1 }
  ).lean();
  const total = chunks.reduce((sum, c) => sum + countWords(c.content), 0);
  await Document.findByIdAndUpdate(documentId, { wordCount: total });
  return total;
}

function splitIntoChunks(content = "", chunkSize = CHUNK_SIZE) {
  const chunks = [];

  let order = 0;
  let start = 0;

  while (start < content.length) {
    chunks.push({
      order,
      content: content.slice(start, start + chunkSize),
    });

    start += chunkSize;
    order++;
  }

  if (!chunks.length) {
    chunks.push({
      order: 0,
      content: "",
    });
  }

  return chunks;
}

async function createChunksForDocument(documentId, content = "") {
  const chunks = splitIntoChunks(content);

  await DocumentChunk.insertMany(
    chunks.map((it) => ({
      documentId,
      order: it.order,
      content: it.content,
    }))
  );

  await recomputeDocumentWordCount(documentId);
}

async function getFullDocumentContent(documentId) {
  const chunks = await DocumentChunk.find({ documentId })
    .sort({ order: 1 })
    .lean();

  return chunks.map((it) => it.content).join("");
}

async function replaceDocumentChunks(documentId, content = "") {
  const chunks = splitIntoChunks(content);

  // Import replaces the whole document. Move each existing order to its next
  // version so editors opened before the import receive a 409 on stale saves.
  const existingChunks = await DocumentChunk.find(
    { documentId },
    { order: 1, version: 1 }
  ).lean();
  const versionsByOrder = new Map(
    existingChunks.map((chunk) => [chunk.order, chunk.version])
  );

  await DocumentChunk.deleteMany({ documentId });

  await DocumentChunk.insertMany(
    chunks.map((it) => ({
      documentId,
      order: it.order,
      content: it.content,
      version: versionsByOrder.has(it.order)
        ? versionsByOrder.get(it.order) + 1
        : 0,
    }))
  );

  await recomputeDocumentWordCount(documentId);
}

module.exports = {
  CHUNK_SIZE,
  splitIntoChunks,
  createChunksForDocument,
  getFullDocumentContent,
  replaceDocumentChunks,
  countWords,
  recomputeDocumentWordCount,
};
