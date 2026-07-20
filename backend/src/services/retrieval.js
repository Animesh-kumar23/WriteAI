const DocumentChunk = require("../models/DocumentChunk");
const Document = require("../models/document");
const { ai } = require("../configs/genai");
const ENV = require("../configs/env");

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return dot / (normA * normB);
}

async function retrieveRelevantChunks({ documentId, userId, queryText }) {
  const owned = await Document.exists({ _id: documentId, userId });
  if (!owned) return [];

  const chunks = await DocumentChunk.find(
    { documentId },
    { order: 1, content: 1 }
  ).sort({ order: 1 }).lean();
  if (!chunks.length) return [];

  const response = await ai.models.embedContent({
    model: ENV.EMBEDDING_MODEL,
    contents: [queryText, ...chunks.map((chunk) => chunk.content)],
  });

  const queryEmbedding = response.embeddings[0].values;
  return chunks
    .map((chunk, index) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, response.embeddings[index + 1].values),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.order - b.order);
}

module.exports = { retrieveRelevantChunks, cosineSimilarity };
