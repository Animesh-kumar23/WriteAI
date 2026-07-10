import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../src/app.js");
const redisConfig = require("../src/configs/redis.js");
const limiterModule = require("../src/middlewares/rateLimit.middleware.js");
const queueModule = require("../src/queues/export.queue.js");

const { redisClient } = redisConfig;
const { initLimiters } = limiterModule;
const { exportQueue } = queueModule;
const User = mongoose.model("User");
const Document = mongoose.model("Document");
const DocumentChunk = mongoose.model("DocumentChunk");

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

beforeAll(async () => {
  assertIsolatedTestServices();
  await mongoose.connect(process.env.DB_URI);
  await redisClient.connect();
  await initLimiters();
  await exportQueue.waitUntilReady();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Document.deleteMany({}),
    DocumentChunk.deleteMany({}),
  ]);

  // The URL guard above ensures this clears database 15, never development DB 0.
  await redisClient.flushDb();
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

  test("saves a chunk when the client version is current", async () => {
    const user = await createUser("save@example.com");
    const { document } = await createDocumentWithChunk(user._id);

    const response = await request(app)
      .patch(`/api/documents/${document._id}/chunks/batch`)
      .set("Authorization", authHeader(user._id))
      .send({
        chunks: [{ order: 0, content: "Saved content" }],
        clientVersions: { 0: 0 },
      });

    expect(response.status).toBe(200);
    expect(response.body.updated).toBe(1);

    const savedChunk = await DocumentChunk.findOne({ documentId: document._id, order: 0 });
    expect(savedChunk.content).toBe("Saved content");
    expect(savedChunk.version).toBe(1);
  });

  test("returns 409 and preserves content for a stale chunk version", async () => {
    const user = await createUser("conflict@example.com");
    const { document } = await createDocumentWithChunk(user._id, {
      content: "Server content",
      version: 1,
    });

    const response = await request(app)
      .patch(`/api/documents/${document._id}/chunks/batch`)
      .set("Authorization", authHeader(user._id))
      .send({
        chunks: [{ order: 0, content: "Stale client content" }],
        clientVersions: { 0: 0 },
      });

    expect(response.status).toBe(409);
    expect(response.body.conflict).toBe(true);
    expect(response.body.conflictedOrders).toEqual([0]);

    const savedChunk = await DocumentChunk.findOne({ documentId: document._id, order: 0 });
    expect(savedChunk.content).toBe("Server content");
    expect(savedChunk.version).toBe(1);
  });

  test("rejects a duplicate AI request when the document lock exists", async () => {
    const user = await createUser("lock@example.com");
    const { document } = await createDocumentWithChunk(user._id);
    await redisClient.set(`ai:lock:${user._id}:${document._id}`, "1", { EX: 120 });

    const response = await request(app)
      .post("/api/ai/stream")
      .set("Authorization", authHeader(user._id))
      .send({
        action: "generate",
        documentId: document._id.toString(),
        documentTitle: document.title,
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already in progress/i);
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
