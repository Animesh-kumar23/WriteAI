import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const redisConfig = require("../src/configs/redis.js");
const queueModule = require("../src/queues/export.queue.js");
const genaiModule = require("../src/configs/genai.js");
const importParserModule = require("../src/utils/import.parser.js");

const { redisClient } = redisConfig;
const { exportQueue } = queueModule;
const { ai } = genaiModule;
let app;
let User;
let Document;
let DocumentChunk;

vi.spyOn(ai.models, "embedContent");
vi.spyOn(ai.models, "generateContent");
vi.spyOn(ai.models, "generateContentStream");
vi.spyOn(importParserModule, "parsePdfBuffer");

const atlasTest = process.env.ATLAS_SEARCH_TEST_URI ? test : test.skip;

function fakeStream(text) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { text };
    },
  };
}

function assertIsolatedTestServices() {
  const mongoDatabase = process.env.DB_URI.split("/").pop()?.split("?")[0];
  if (!mongoDatabase?.endsWith("_test")) {
    throw new Error("Backend tests require a MongoDB database ending in _test.");
  }

  const redisUrl = new URL(process.env.REDIS_URL);
  if (redisUrl.pathname !== "/15") {
    throw new Error("Backend tests require dedicated Redis database 15.");
  }
}

function authHeader(userId) {
  const token = jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET_KEY, {
    expiresIn: "10m",
  });
  return `Bearer ${token}`;
}

async function createUser(email) {
  return User.create({
    name: "Test User",
    email,
    password: "Password1",
  });
}

async function createDocumentWithChunk(userId, overrides = {}) {
  const document = await Document.create({
    userId,
    title: overrides.title ?? "Test Document",
    subtitle: "Integration test",
  });
  const chunk = await DocumentChunk.create({
    documentId: document._id,
    order: 0,
    content: overrides.content ?? "Initial content",
    version: overrides.version ?? 0,
  });
  return { document, chunk };
}

function saveChunks(userId, documentId, chunks, clientVersions) {
  const body = { chunks };
  if (clientVersions !== undefined) body.clientVersions = clientVersions;

  return request(app)
    .patch(`/api/documents/${documentId}/chunks/batch`)
    .set("Authorization", authHeader(userId))
    .send(body);
}

function createHeldStream() {
  let markOpened;
  let release;
  const opened = new Promise((resolve) => {
    markOpened = resolve;
  });
  const released = new Promise((resolve) => {
    release = resolve;
  });

  return {
    opened,
    release,
    stream: {
      async *[Symbol.asyncIterator]() {
        markOpened();
        await released;
        yield { text: "generated text" };
      },
    },
  };
}

beforeAll(async () => {
  assertIsolatedTestServices();
  await mongoose.connect(process.env.DB_URI);
  await redisClient.connect();
  app = require("../src/app.js");
  User = mongoose.model("User");
  Document = mongoose.model("Document");
  DocumentChunk = mongoose.model("DocumentChunk");
  await exportQueue.waitUntilReady();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Document.deleteMany({}),
    DocumentChunk.deleteMany({}),
  ]);

  await redisClient.flushDb();
  ai.models.embedContent.mockReset();
  ai.models.generateContent.mockReset();
  ai.models.generateContentStream.mockReset();
  importParserModule.parsePdfBuffer.mockReset();
});

afterAll(async () => {
  if (exportQueue) await exportQueue.close();
  await Promise.all([
    User.deleteMany({}),
    Document.deleteMany({}),
    DocumentChunk.deleteMany({}),
  ]);
  if (redisClient?.isOpen) {
    await redisClient.flushDb();
    await redisClient.quit();
  }
  await mongoose.disconnect();
});

describe("WriteAI API integration", () => {
  test("rejects unauthenticated document requests", async () => {
    const response = await request(app).get("/api/documents");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("No token provided!");
  });

  test("prevents one user from reading another user's document", async () => {
    const owner = await createUser("owner@example.com");
    const otherUser = await createUser("other@example.com");
    const { document } = await createDocumentWithChunk(owner._id);

    const response = await request(app)
      .get(`/api/documents/${document._id}`)
      .set("Authorization", authHeader(otherUser._id));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
  });

  test("editing preserves the saved chunk version when refetched", async () => {
    const user = await createUser("version-roundtrip@example.com");
    const { document } = await createDocumentWithChunk(user._id, { version: 4 });

    const saveResponse = await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "Saved content" }],
      { 0: 4 }
    );
    expect(saveResponse.status).toBe(200);

    const savedChunk = await DocumentChunk.findOne({ documentId: document._id, order: 0 });
    const refetchResponse = await request(app)
      .get(`/api/documents/${document._id}/chunks?all=true`)
      .set("Authorization", authHeader(user._id));

    expect(refetchResponse.status).toBe(200);
    expect(refetchResponse.body.chunks[0]).toMatchObject({
      order: 0,
      content: "Saved content",
      version: savedChunk.version,
    });
    expect(refetchResponse.body.chunks[0].version).toBe(5);
  });

  test("a second same-chunk save from a stale version returns 409 with conflict data", async () => {
    const user = await createUser("same-chunk-conflict@example.com");
    const { document } = await createDocumentWithChunk(user._id, { version: 1 });

    const firstSave = await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "First editor content" }],
      { 0: 1 }
    );
    const staleSave = await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "Stale editor content" }],
      { 0: 1 }
    );

    expect(firstSave.status).toBe(200);
    expect(staleSave.status).toBe(409);
    expect(staleSave.body).toMatchObject({
      conflict: true,
      conflictedOrders: [0],
      serverChunks: [{ order: 0, content: "First editor content", version: 2 }],
    });
  });

  test("edits to different chunks merge without a conflict", async () => {
    const user = await createUser("different-chunks@example.com");
    const { document } = await createDocumentWithChunk(user._id, { version: 0 });
    await DocumentChunk.create({
      documentId: document._id,
      order: 1,
      content: "Second initial chunk",
      version: 0,
    });

    const firstSave = await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "Editor A" }],
      { 0: 0 }
    );
    const secondSave = await saveChunks(
      user._id,
      document._id,
      [{ order: 1, content: "Editor B" }],
      { 1: 0 }
    );

    expect(firstSave.status).toBe(200);
    expect(secondSave.status).toBe(200);
    const chunks = await DocumentChunk.find({ documentId: document._id }).sort({ order: 1 }).lean();
    expect(chunks.map(({ order, content, version }) => ({ order, content, version }))).toEqual([
      { order: 0, content: "Editor A", version: 1 },
      { order: 1, content: "Editor B", version: 1 },
    ]);
  });

  test("keep-mine overwrites once, bumps version, and resumes conflict checking", async () => {
    const user = await createUser("keep-mine@example.com");
    const { document } = await createDocumentWithChunk(user._id, { version: 1 });

    await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "Other tab content" }],
      { 0: 1 }
    );
    const forcedSave = await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "Keep my content" }]
    );
    const staleSave = await saveChunks(
      user._id,
      document._id,
      [{ order: 0, content: "Old stale content" }],
      { 0: 1 }
    );

    expect(forcedSave.status).toBe(200);
    const forcedChunk = await DocumentChunk.findOne({ documentId: document._id, order: 0 }).lean();
    expect(forcedChunk).toMatchObject({ content: "Keep my content", version: 3 });
    expect(staleSave.status).toBe(409);
    expect(staleSave.body.serverChunks[0]).toMatchObject({
      order: 0,
      content: "Keep my content",
      version: 3,
    });
  });

  test("PDF import advances versions for existing chunk orders", async () => {
    const user = await createUser("pdf-import-versions@example.com");
    const { document } = await createDocumentWithChunk(user._id, { version: 2 });
    await DocumentChunk.create({
      documentId: document._id,
      order: 1,
      content: "Old second chunk",
      version: 7,
    });
    importParserModule.parsePdfBuffer.mockResolvedValue(`${"A".repeat(4000)}${"B".repeat(100)}`);

    const response = await request(app)
      .post(`/api/documents/${document._id}/import`)
      .set("Authorization", authHeader(user._id))
      .attach("importFile", Buffer.from("mock PDF bytes"), {
        filename: "replacement.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(200);
    const chunks = await DocumentChunk.find({ documentId: document._id }).sort({ order: 1 }).lean();
    expect(chunks.map(({ order, version }) => ({ order, version }))).toEqual([
      { order: 0, version: 3 },
      { order: 1, version: 8 },
    ]);
  });

  test("content-only search returns the owning document", async () => {
    const user = await createUser("content-search@example.com");
    const { document, chunk } = await createDocumentWithChunk(user._id, {
      title: "Ordinary title",
      content: "The body contains quasarneedle and the title does not.",
    });
    const titleSearch = vi.spyOn(Document, "aggregate").mockResolvedValue([]);
    const chunkSearch = vi.spyOn(DocumentChunk, "aggregate").mockResolvedValue([chunk.toObject()]);

    try {
      const response = await request(app)
        .get("/api/documents/search?q=quasarneedle")
        .set("Authorization", authHeader(user._id));

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual([
        expect.objectContaining({
          documentId: document._id.toString(),
          title: "Ordinary title",
          titleMatch: false,
          chunkMatches: [expect.objectContaining({ order: 0 })],
        }),
      ]);
      const chunkPipeline = chunkSearch.mock.calls[0][0];
      expect(chunkPipeline[1].$match.documentId.$in.map(String)).toContain(document._id.toString());
    } finally {
      titleSearch.mockRestore();
      chunkSearch.mockRestore();
    }
  });

  atlasTest("a known-good query executes against Atlas Search and returns results", async () => {
    const client = new mongoose.mongo.MongoClient(process.env.ATLAS_SEARCH_TEST_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    try {
      await client.connect();
      const documents = client.db().collection("documents");
      const sample = await documents.findOne(
        { title: { $regex: /[A-Za-z0-9]{3}/ } },
        { projection: { title: 1 } }
      );
      expect(sample).toBeTruthy();

      const results = await documents.aggregate([
        {
          $search: {
            index: "documents_and_chunks",
            text: { query: sample.title, path: ["title", "subtitle"], fuzzy: { maxEdits: 1 } },
          },
        },
        { $limit: 50 },
        { $project: { _id: 1 } },
      ]).toArray();

      expect(results.length).toBeGreaterThan(0);
      expect(results.map((result) => result._id.toString())).toContain(sample._id.toString());
    } finally {
      await client.close();
    }
  }, 20000);

  test("AI lock rejects concurrent generation on the same document", async () => {
    const user = await createUser("same-document-lock@example.com");
    const { document } = await createDocumentWithChunk(user._id);
    const held = createHeldStream();
    ai.models.generateContentStream.mockResolvedValueOnce(held.stream);

    const firstResponsePromise = request(app)
      .post("/api/ai/stream")
      .set("Authorization", authHeader(user._id))
      .send({
        action: "generate",
        documentId: document._id.toString(),
        documentTitle: document.title,
      })
      .then((response) => response);

    await held.opened;
    const today = new Date().toISOString().slice(0, 10);
    await redisClient.del(`ai:daily:${user._id}:${today}`);
    try {
      const secondResponse = await request(app)
        .post("/api/ai/stream")
        .set("Authorization", authHeader(user._id))
        .send({
          action: "generate",
          documentId: document._id.toString(),
          documentTitle: document.title,
        });

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.error).toMatch(/already in progress/i);
    } finally {
      held.release();
    }
    expect((await firstResponsePromise).status).toBe(200);
  });

  test("AI lock allows concurrent generation on different documents", async () => {
    const user = await createUser("different-document-locks@example.com");
    const { document: firstDocument } = await createDocumentWithChunk(user._id, {
      title: "First document",
    });
    const { document: secondDocument } = await createDocumentWithChunk(user._id, {
      title: "Second document",
    });
    const held = createHeldStream();
    ai.models.generateContentStream
      .mockResolvedValueOnce(held.stream)
      .mockResolvedValueOnce(fakeStream("second generated text"));

    const firstResponsePromise = request(app)
      .post("/api/ai/stream")
      .set("Authorization", authHeader(user._id))
      .send({
        action: "generate",
        documentId: firstDocument._id.toString(),
        documentTitle: firstDocument.title,
      })
      .then((response) => response);

    await held.opened;
    const today = new Date().toISOString().slice(0, 10);
    await redisClient.del(`ai:daily:${user._id}:${today}`);
    try {
      const secondResponse = await request(app)
        .post("/api/ai/stream")
        .set("Authorization", authHeader(user._id))
        .send({
          action: "generate",
          documentId: secondDocument._id.toString(),
          documentTitle: secondDocument.title,
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.text).toBe("second generated text");
    } finally {
      held.release();
    }
    expect((await firstResponsePromise).status).toBe(200);
  });

  test("returns 429 when the daily AI quota is exhausted", async () => {
    const user = await createUser("quota@example.com");
    const today = new Date().toISOString().slice(0, 10);
    await redisClient.set(`ai:daily:${user._id}:${today}`, "1", { EX: 3600 });

    const response = await request(app)
      .post("/api/ai/stream")
      .set("Authorization", authHeader(user._id))
      .send({ action: "generate", documentTitle: "Quota test" });

    expect(response.status).toBe(429);
    expect(response.body.reason).toBe("daily_limit_exceeded");
    expect(response.body.limit).toBe(1);
  });

  test("queues an owned document export and returns its job ID", async () => {
    const user = await createUser("export@example.com");
    const { document } = await createDocumentWithChunk(user._id);

    const response = await request(app)
      .post(`/api/exports/${document._id}/pdf`)
      .set("Authorization", authHeader(user._id));

    expect(response.status).toBe(202);
    expect(response.body.jobId).toBeTruthy();

    const job = await exportQueue.getJob(response.body.jobId);
    expect(job).not.toBeNull();
    expect(job.data).toEqual({
      documentId: document._id.toString(),
      format: "pdf",
      userId: user._id.toString(),
    });

    await job.remove();
    expect(await exportQueue.getJob(response.body.jobId)).toBeUndefined();
  });
});
