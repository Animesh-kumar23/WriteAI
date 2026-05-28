const DocumentChunk = require("../models/DocumentChunk");
const Document = require("../models/document");

const CHUNK_SIZE = 4000;

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

  await DocumentChunk.deleteMany({ documentId });

  await DocumentChunk.insertMany(
    chunks.map((it) => ({
      documentId,
      order: it.order,
      content: it.content,
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