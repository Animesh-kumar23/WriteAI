const DocumentChunk = require("../models/DocumentChunk");

const CHUNK_SIZE = 4000;

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
}

module.exports = {
  CHUNK_SIZE,
  splitIntoChunks,
  createChunksForDocument,
  getFullDocumentContent,
  replaceDocumentChunks,
};