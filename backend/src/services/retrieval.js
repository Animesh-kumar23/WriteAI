const crypto = require("crypto");
const mongoose = require("mongoose");
const DocumentChunk = require("../models/DocumentChunk");
const Document = require("../models/document");
const { ai } = require("../configs/genai");
const { redisClient } = require("../configs/redis");
const ENV = require("../configs/env");

const TOP_K = 3;
const MIN_SIMILARITY_FLOOR = 0.3;            // sanity floor only — excludes cases where even the best match is noise
const RELATIVE_BAND = 0.08;                  // primary filter: keep candidates within this distance of the best score
const MAX_CANDIDATE_CHUNKS = 30;             // bound cost on large docs — only the most recent chunks are considered
const MAX_EMBEDDING_CHARS_PER_CHUNK = 4000;  // truncates only what's SENT TO THE EMBEDDING API, never the prompt text
const MAX_QUERY_EMBEDDING_CHARS = 3000;      // same idea, for the query text — the service enforces its own invariant
const MAX_TOTAL_EMBEDDING_CHARS = 60000;     // stop adding candidates once this budget (minus the query) is spent
const EMBEDDING_BATCH_SIZE = 10;             // texts per embedContent call
const MAX_RETRIEVED_CONTEXT_CHARS = 10000;   // cap on what actually lands in the generation prompt
const EMBEDDING_DIMENSIONS = 768;            // part of the cache key — a dimension change must not reuse old vectors
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // bounds Redis growth; correctness doesn't depend on this since keys are content-addressed

// Explicit norm division makes this valid even for non-normalized vectors —
// relevant because reduced-dimensionality gemini-embedding-001 output isn't
// automatically unit-length, and this function normalizes as part of the
// comparison rather than requiring pre-normalized inputs.
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  const result = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number.isFinite(result) ? result : 0; // guards overflow from very large (but individually finite) inputs
}

function normalizeForComparison(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// A batch response can have the right LENGTH but still contain one malformed
// individual vector (wrong size, or containing a non-finite value) — validate
// each vector, not just the batch count, before it's used or cached.
function isValidEmbedding(values) {
  return (
    Array.isArray(values) &&
    values.length === EMBEDDING_DIMENSIONS &&
    values.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

// taskType is part of the key: Gemini's task-conditioned embeddings mean the
// same text embedded as a query vs. a document can legitimately produce
// different vectors, so a query-embedding cache hit must never be served
// back for a document-embedding request (or vice versa).
function cacheKey(text, taskType) {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  return ["embed", ENV.EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, taskType, hash].join(":");
}

// Reads the Redis cache per-entry (one malformed value doesn't poison the whole batch,
// and a cached vector of the wrong length/shape is treated as a miss, not trusted),
// dedupes identical texts before calling the API, and embeds the rest in bounded
// batches. `taskType` follows the SDK's EmbedContentConfig.taskType field
// (RETRIEVAL_QUERY for the query text, RETRIEVAL_DOCUMENT for chunks). A single
// failed batch is caught and logged — its texts stay `null` in the result so the
// rest of the request can still proceed with whatever did succeed.
async function embedTexts(texts, taskType) {
  const results = new Array(texts.length).fill(null);
  const uncachedIndexes = [];

  if (redisClient) {
    try {
      const cached = await Promise.all(texts.map((t) => redisClient.get(cacheKey(t, taskType))));
      cached.forEach((raw, i) => {
        if (!raw) { uncachedIndexes.push(i); return; }
        try {
          const parsed = JSON.parse(raw);
          if (isValidEmbedding(parsed)) results[i] = parsed;
          else uncachedIndexes.push(i); // right shape but malformed values, or wrong shape — treat as a miss either way
        } catch {
          uncachedIndexes.push(i);
        }
      });
    } catch {
      uncachedIndexes.push(...texts.map((_, i) => i)); // Redis hiccup — embed everything fresh
    }
  } else {
    uncachedIndexes.push(...texts.map((_, i) => i));
  }

  const textToIndexes = new Map();
  uncachedIndexes.forEach((i) => {
    if (!textToIndexes.has(texts[i])) textToIndexes.set(texts[i], []);
    textToIndexes.get(texts[i]).push(i);
  });
  const uniqueTexts = [...textToIndexes.keys()];

  for (let i = 0; i < uniqueTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = uniqueTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    try {
      const response = await ai.models.embedContent({
        model: ENV.EMBEDDING_MODEL,
        contents: batch,
        config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
      });
      // gemini-embedding-001 returns one embedding per input string, in order — this is
      // the specific behavior this batching code relies on. Validate rather than trust
      // it, so a future model swap with different batching semantics (e.g. one that
      // aggregates multiple inputs into one vector) fails loudly here instead of
      // silently mis-mapping vectors to the wrong chunk.
      if (!Array.isArray(response.embeddings) || response.embeddings.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${response.embeddings?.length ?? 0}`);
      }
      batch.forEach((text, j) => {
        const values = response.embeddings[j]?.values;
        if (!isValidEmbedding(values)) return; // this one text stays unresolved; the rest of the batch still proceeds
        textToIndexes.get(text).forEach((idx) => { results[idx] = values; });
        if (redisClient) {
          redisClient.set(cacheKey(text, taskType), JSON.stringify(values), { EX: CACHE_TTL_SECONDS }).catch(() => {});
        }
      });
    } catch (error) {
      console.warn("Embedding batch failed, skipping these texts:", { batchSize: batch.length, message: error.message });
      // results for this batch stay null — callers filter those out rather than failing outright
    }
  }

  return results;
}

// Embedded separately from chunks: if the query itself can't be embedded, nothing
// downstream can be scored, so this failure should short-circuit retrieval entirely
// rather than being lumped into the same partial-failure tolerance as chunk batches.
async function embedQuery(text) {
  const prepared = text.trim().slice(-MAX_QUERY_EMBEDDING_CHARS);
  const [vector] = await embedTexts([prepared], "RETRIEVAL_QUERY");
  return vector; // null if the embed call failed
}

async function embedChunks(texts) {
  return embedTexts(texts, "RETRIEVAL_DOCUMENT");
}

function takeWithinBudget(chunks, maxChars) {
  const selected = [];
  let used = 0;
  for (const chunk of chunks) {
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    const content = chunk.content.length > remaining ? chunk.content.slice(0, remaining) : chunk.content;
    selected.push({ ...chunk, content });
    used += content.length;
  }
  return selected;
}

async function retrieveRelevantChunks({ documentId, userId, queryText, excludeText = "" }) {
  if (!ENV.RAG_ENABLED || !queryText || !queryText.trim()) return [];
  // A malformed ObjectId is a routine client-input case, not a RAG operational failure —
  // check it explicitly rather than letting a Mongoose CastError fall into the catch
  // block below and get logged as if something actually went wrong.
  if (!mongoose.isValidObjectId(documentId) || !mongoose.isValidObjectId(userId)) return [];

  try {
    // documentId is client-supplied — authentication proves who's asking, not that they own THIS document.
    const owned = await Document.exists({ _id: documentId, userId });
    if (!owned) return [];

    const chunks = await DocumentChunk.find(
      { documentId },
      { order: 1, content: 1 }
    ).sort({ order: -1 }).limit(MAX_CANDIDATE_CHUNKS).lean(); // most recent first — recency-bounded pool, relevance-ranked within it

    const normalizedExclude = normalizeForComparison(excludeText);
    const queryCost = Math.min(queryText.length, MAX_QUERY_EMBEDDING_CHARS);
    let budget = MAX_TOTAL_EMBEDDING_CHARS - queryCost;
    const candidates = [];
    for (const c of chunks) {
      const trimmed = c.content.trim();
      if (!trimmed || normalizedExclude.includes(normalizeForComparison(trimmed))) continue;
      // Debit the budget by the exact string that will be sent to the embedding
      // API, not a separately-derived estimate of it — otherwise a chunk whose
      // "cost" and actual API input diverge (e.g. padding stripped from one but
      // not the other) can look cheap here while still costing full price below.
      const embeddingText = trimmed.slice(0, MAX_EMBEDDING_CHARS_PER_CHUNK);
      // Skip (don't stop) an oversized candidate — the loop is already bounded to
      // MAX_CANDIDATE_CHUNKS (30) chunks total, so there's no runaway risk, and a
      // smaller, older chunk further down should still get a chance to use the
      // remaining budget rather than the whole pass giving up on the first chunk
      // that doesn't fit.
      if (embeddingText.length > budget) continue;
      candidates.push({ ...c, embeddingText });
      budget -= embeddingText.length;
    }
    if (!candidates.length) return [];

    const queryEmbedding = await embedQuery(queryText);
    if (!queryEmbedding) return []; // can't score anything without a query vector

    const chunkEmbeddings = await embedChunks(candidates.map((c) => c.embeddingText));

    const ranked = candidates
      .map((c, i) => ({
        order: c.order,
        content: c.content,
        score: chunkEmbeddings[i] ? cosineSimilarity(queryEmbedding, chunkEmbeddings[i]) : -1,
      }))
      .filter((c) => c.score >= MIN_SIMILARITY_FLOOR)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) return [];

    const bestScore = ranked[0].score;
    const selected = ranked
      .filter((c) => c.score >= bestScore - RELATIVE_BAND)
      .slice(0, TOP_K)
      .sort((a, b) => a.order - b.order); // back to document order for a coherent prompt

    if (ENV.NODE_ENV === "development") {
      console.log("RAG scores:", selected.map((c) => ({ order: c.order, score: c.score.toFixed(3) })));
    }

    return takeWithinBudget(selected, MAX_RETRIEVED_CONTEXT_CHARS);
  } catch (error) {
    console.error("RAG retrieval failed (continuing without it):", error);
    return [];
  }
}

module.exports = { retrieveRelevantChunks, cosineSimilarity, cacheKey };
