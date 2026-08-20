/**
 * Chunked autosave benchmark.
 *
 * WriteAI stores a document as ordered chunks, so an autosave only sends the
 * chunk the user actually edited. This script measures what that buys by
 * running the same edits twice against the real Express API and the real
 * MongoDB:
 *
 *   chunked - the document is split at config/chunkLimits.json (4,000 chars)
 *   whole   - the document is stored as one chunk, so every save sends it all
 *
 * Nothing in src/ is changed or mocked. The only difference between the two
 * runs is how many chunks the document was split into when it was seeded.
 *
 * Run it with:  pnpm --dir backend bench
 */

// Point at the local test databases before any config file reads process.env.
// dotenv does not overwrite variables that are already set, so these win over
// backend/.env and the benchmark can never touch the real database.
process.env.NODE_ENV = "test";
process.env.DB_URI =
  process.env.BENCH_DB_URI ?? "mongodb://127.0.0.1:27017/writeai_bench_test";
process.env.REDIS_URL = process.env.BENCH_REDIS_URL ?? "redis://127.0.0.1:6379/15";
process.env.JWT_SECRET_KEY = "writeai-benchmark-secret-not-for-production";
process.env.GEMINI_API_KEY = "writeai-benchmark-key-no-api-calls";
process.env.CLIENT_URL = "http://localhost:5173";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const { redisClient } = require("../src/configs/redis");
const { exportQueue } = require("../src/queues/export.queue");
const { splitIntoChunks } = require("../src/utils/documentChunks");
const chunkLimits = require("../../config/chunkLimits.json");
const User = require("../src/models/User");
const Document = require("../src/models/document");
const DocumentChunk = require("../src/models/DocumentChunk");

// ---------------------------------------------------------------------------
// What we measure
// ---------------------------------------------------------------------------

const DOCUMENT_SIZES_KB = [10, 50, 200];
const SAVES_PER_RUN = 50;
const WARMUP_SAVES = 10;
const LOAD_SAMPLES = 5;
const CONFLICT_PAIRS = 10;
const CONFLICT_SIZE_KB = 50;

const MODES = [
  {
    key: "chunked",
    label: `chunked (${chunkLimits.targetChunkCharacters} chars)`,
    chunkSize: chunkLimits.targetChunkCharacters,
  },
  {
    key: "whole",
    // One chunk holding the whole document is exactly what "no chunking" means:
    // every autosave has to send the entire document body.
    label: "whole document",
    chunkSize: Infinity,
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// A tiny seeded random number generator so every run produces the same
// document text and the same sequence of edit positions.
function makeRandom(seed) {
  let state = seed;
  return function random() {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const WORDS = (
  "the editor stores every document as ordered chunks so an autosave only " +
  "writes the part that actually changed which keeps requests small and " +
  "conflicts rare while a writer drafts long form content in markdown"
).split(" ");

// Builds roughly `bytes` of paragraph-shaped markdown text.
function makeDocumentText(bytes) {
  const random = makeRandom(42);
  let text = "";

  while (text.length < bytes) {
    const sentences = 3 + Math.floor(random() * 4);
    let paragraph = "";

    for (let i = 0; i < sentences; i++) {
      const length = 8 + Math.floor(random() * 12);
      const words = [];
      for (let w = 0; w < length; w++) {
        words.push(WORDS[Math.floor(random() * WORDS.length)]);
      }
      paragraph += words.join(" ") + ". ";
    }

    text += paragraph.trim() + "\n\n";
  }

  return text.slice(0, bytes);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

// ---------------------------------------------------------------------------
// The simulated editor
// ---------------------------------------------------------------------------

// The real editor (frontend/src/lib/documentModel.js) maps a caret position to
// the one chunk that contains it and marks only that chunk dirty. This is the
// same rule: find the chunk that owns a character offset.
function chunkIndexForOffset(chunks, offset) {
  let start = 0;

  for (let i = 0; i < chunks.length; i++) {
    const end = start + chunks[i].content.length;
    if (offset < end) return i;
    start = end;
  }

  return chunks.length - 1;
}

// Types a few characters into the chunk that owns `offset`, and returns that
// chunk - the only one an autosave would send.
function applyEdit(chunks, offset) {
  const index = chunkIndexForOffset(chunks, offset);
  const chunk = chunks[index];
  const at = Math.min(offset, chunk.content.length);

  chunk.content = chunk.content.slice(0, at) + " edit" + chunk.content.slice(at);

  return chunk;
}

async function loadChunks(client, documentId) {
  const started = performance.now();
  const response = await fetch(`${client.baseUrl}/api/documents/${documentId}/chunks`, {
    headers: { Authorization: client.authorization },
  });
  const body = await response.json();
  const ms = performance.now() - started;

  if (!response.ok) throw new Error(`Load failed: ${response.status}`);

  return {
    ms,
    chunks: body.chunks.map((c) => ({
      order: c.order,
      content: c.content,
      version: c.version,
    })),
  };
}

// One autosave: PATCH the dirty chunk, timed end to end over real HTTP.
async function saveChunk(client, documentId, chunk) {
  const body = JSON.stringify({
    chunks: [{ order: chunk.order, content: chunk.content }],
    clientVersions: { [chunk.order]: chunk.version },
  });

  const started = performance.now();
  const response = await fetch(
    `${client.baseUrl}/api/documents/${documentId}/chunks/batch`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: client.authorization,
      },
      body,
    }
  );
  const payload = await response.json();
  const ms = performance.now() - started;

  if (response.status === 200) {
    const saved = payload.savedChunks.find((c) => c.order === chunk.order);
    if (saved) chunk.version = saved.version;
  }

  return { ms, bytes: Buffer.byteLength(body), status: response.status };
}

async function seedDocument(userId, content, chunkSize) {
  const document = await Document.create({
    userId,
    title: "Benchmark document",
  });

  const now = new Date();
  // Insert through the raw driver rather than the model: the "whole document"
  // arm deliberately stores one chunk far bigger than the schema's max length,
  // which is the whole point of the comparison.
  await DocumentChunk.collection.insertMany(
    splitIntoChunks(content, chunkSize).map((chunk) => ({
      documentId: document._id,
      order: chunk.order,
      content: chunk.content,
      version: 0,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    }))
  );

  return document;
}

async function removeDocument(document) {
  await DocumentChunk.deleteMany({ documentId: document._id });
  await document.deleteOne();
}

// ---------------------------------------------------------------------------
// Experiment 1 - autosave payload and latency
// ---------------------------------------------------------------------------

// Both arms are set up on the same text and then saved alternately, one save
// each, turn by turn. Measuring them back to back like this is what makes the
// comparison trustworthy on a normal laptop: if something else on the machine
// steals time for a moment, it lands on both arms instead of on whichever one
// happened to be running.
async function measureAutosave(client, userId, sizeKb) {
  const content = makeDocumentText(sizeKb * 1024);

  const arms = MODES.map((mode) => ({ mode, latencies: [], payloads: [], loadTimes: [] }));

  for (const arm of arms) {
    arm.document = await seedDocument(userId, content, arm.mode.chunkSize);
    arm.documentId = arm.document._id.toString();
  }

  // Opening the document, also alternated, reported as the median of a few
  // samples so one slow request does not decide the number.
  for (let i = 0; i < LOAD_SAMPLES; i++) {
    for (const arm of arms) {
      const loaded = await loadChunks(client, arm.documentId);
      arm.loadTimes.push(loaded.ms);
      arm.chunks = loaded.chunks;
    }
  }

  const random = makeRandom(7);

  for (let i = 0; i < WARMUP_SAVES + SAVES_PER_RUN; i++) {
    // The same edit, at the same position in the same text, for both arms.
    const offset = Math.floor(random() * content.length);

    // Alternate which arm saves first so neither one always pays for being
    // the one that wakes the database up.
    const turn = i % 2 === 0 ? arms : [...arms].reverse();

    for (const arm of turn) {
      const result = await saveChunk(client, arm.documentId, applyEdit(arm.chunks, offset));

      if (result.status !== 200) {
        throw new Error(`Save returned ${result.status} in ${arm.mode.key} mode`);
      }

      if (i >= WARMUP_SAVES) {
        arm.latencies.push(result.ms);
        arm.payloads.push(result.bytes);
      }
    }
  }

  const row = { sizeKb };

  for (const arm of arms) {
    await removeDocument(arm.document);

    row[arm.mode.key] = {
      chunkCount: arm.chunks.length,
      payloadBytes: Math.round(mean(arm.payloads)),
      latencyP50: round(percentile(arm.latencies, 50)),
      latencyP95: round(percentile(arm.latencies, 95)),
      loadMs: round(percentile(arm.loadTimes, 50)),
    };
  }

  return row;
}

// ---------------------------------------------------------------------------
// Experiment 2 - conflicts between two tabs editing different sections
// ---------------------------------------------------------------------------

async function measureConflicts(client, userId, mode) {
  const content = makeDocumentText(CONFLICT_SIZE_KB * 1024);
  let rejected = 0;

  for (let i = 0; i < CONFLICT_PAIRS; i++) {
    const document = await seedDocument(userId, content, mode.chunkSize);
    const documentId = document._id.toString();

    // Two tabs open the same document at the same time.
    const tabA = (await loadChunks(client, documentId)).chunks;
    const tabB = (await loadChunks(client, documentId)).chunks;

    // They edit far-apart sections that do not overlap in the text at all.
    const nearStart = Math.floor(content.length * 0.05);
    const nearEnd = Math.floor(content.length * 0.95);

    const first = await saveChunk(client, documentId, applyEdit(tabA, nearStart));
    const second = await saveChunk(client, documentId, applyEdit(tabB, nearEnd));

    if (first.status !== 200) throw new Error("The first writer should always win");
    if (second.status === 409) rejected++;

    await removeDocument(document);
  }

  return {
    pairs: CONFLICT_PAIRS,
    rejected,
    rejectedPercent: round((rejected / CONFLICT_PAIRS) * 100, 0),
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function drop(before, after) {
  return round(((before - after) / before) * 100, 1);
}

function kb(bytes) {
  return round(bytes / 1024, 1);
}

function report(results) {
  const lines = [];

  lines.push("");
  lines.push("Autosave payload - bytes sent per save");
  lines.push("| Document | No chunking | Chunked | Reduction |");
  lines.push("| --- | --- | --- | --- |");
  results.autosave.forEach((row) => {
    lines.push(
      `| ${row.sizeKb} KB | ${kb(row.whole.payloadBytes)} KB | ${kb(row.chunked.payloadBytes)} KB | ${drop(row.whole.payloadBytes, row.chunked.payloadBytes)}% |`
    );
  });

  lines.push("");
  lines.push(`Autosave latency - p50 / p95 over ${SAVES_PER_RUN} saves`);
  lines.push("| Document | No chunking | Chunked | p50 reduction |");
  lines.push("| --- | --- | --- | --- |");
  results.autosave.forEach((row) => {
    lines.push(
      `| ${row.sizeKb} KB | ${row.whole.latencyP50} / ${row.whole.latencyP95} ms | ${row.chunked.latencyP50} / ${row.chunked.latencyP95} ms | ${drop(row.whole.latencyP50, row.chunked.latencyP50)}% |`
    );
  });

  lines.push("");
  lines.push("Document open - GET /chunks, the cost side of chunking");
  lines.push("| Document | No chunking | Chunked | Chunks read |");
  lines.push("| --- | --- | --- | --- |");
  results.autosave.forEach((row) => {
    lines.push(
      `| ${row.sizeKb} KB | ${row.whole.loadMs} ms | ${row.chunked.loadMs} ms | ${row.chunked.chunkCount} |`
    );
  });

  lines.push("");
  lines.push(
    `Concurrent edits to different sections - ${CONFLICT_PAIRS} pairs on a ${CONFLICT_SIZE_KB} KB document`
  );
  lines.push("| Mode | Second save rejected |");
  lines.push("| --- | --- |");
  lines.push(
    `| No chunking | ${results.conflicts.whole.rejected}/${results.conflicts.whole.pairs} (${results.conflicts.whole.rejectedPercent}%) |`
  );
  lines.push(
    `| Chunked | ${results.conflicts.chunked.rejected}/${results.conflicts.chunked.pairs} (${results.conflicts.chunked.rejectedPercent}%) |`
  );
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function assertIsolatedServices() {
  const database = process.env.DB_URI.split("/").pop()?.split("?")[0];
  if (!database?.endsWith("_test")) {
    throw new Error("The benchmark requires a MongoDB database ending in _test.");
  }

  if (new URL(process.env.REDIS_URL).pathname !== "/15") {
    throw new Error("The benchmark requires dedicated Redis database 15.");
  }
}

// Node compiles and optimises code as it runs, so the very first requests are
// always the slowest. Burning through a throwaway document first means the
// measured numbers describe a warm server rather than a cold start.
async function warmUp(client, userId) {
  const document = await seedDocument(userId, makeDocumentText(20 * 1024), 4000);
  const documentId = document._id.toString();
  const { chunks } = await loadChunks(client, documentId);

  for (let i = 0; i < 20; i++) {
    await saveChunk(client, documentId, applyEdit(chunks, i * 137));
  }

  await removeDocument(document);
}

async function main() {
  assertIsolatedServices();

  await mongoose.connect(process.env.DB_URI);
  await redisClient.connect();

  const app = require("../src/app");
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const user = await User.create({
    name: "Benchmark User",
    email: `bench-${Date.now()}@example.com`,
    password: "Password1",
  });

  const client = {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    authorization: `Bearer ${jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30m" }
    )}`,
  };

  const results = {
    recordedAt: new Date().toISOString(),
    node: process.version,
    settings: { SAVES_PER_RUN, WARMUP_SAVES, CONFLICT_PAIRS, CONFLICT_SIZE_KB },
    autosave: [],
    conflicts: {},
  };

  console.log("  warming up");
  await warmUp(client, user._id);

  for (const sizeKb of DOCUMENT_SIZES_KB) {
    // The API is rate limited to 300 requests per window. Clearing the
    // counters keeps a long benchmark from throttling itself.
    await redisClient.flushDb();
    console.log(`  measuring autosave: ${sizeKb} KB document`);
    results.autosave.push(await measureAutosave(client, user._id, sizeKb));
  }

  for (const mode of MODES) {
    await redisClient.flushDb();
    console.log(`  measuring conflicts: ${mode.label}`);
    results.conflicts[mode.key] = await measureConflicts(client, user._id, mode);
  }

  console.log(report(results));

  fs.writeFileSync(
    path.join(__dirname, "results.json"),
    JSON.stringify(results, null, 2) + "\n"
  );
  console.log("Raw numbers written to backend/benchmarks/results.json");

  await User.deleteMany({});
  await Document.deleteMany({});
  await DocumentChunk.deleteMany({});
  await redisClient.flushDb();

  await new Promise((resolve) => server.close(resolve));
  await exportQueue.close();
  await redisClient.quit();
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
