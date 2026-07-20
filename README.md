# WriteAI

> An AI document editor built around chunk-based persistence, per-chunk optimistic concurrency, HTTP streaming generation, cosine-similarity retrieval, and queued PDF export.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-writeai--teal.vercel.app-7c3aed?style=flat-square&logo=vercel&logoColor=white)](https://writeai-teal.vercel.app)
[![CI](https://github.com/Animesh-kumar23/WriteAI/actions/workflows/ci.yml/badge.svg)](https://github.com/Animesh-kumar23/WriteAI/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

WriteAI is a single-writer document editor with a Google Gemini writing assistant. You draft in a Markdown editor, the AI streams text into the document token by token, and everything is stored as ordered chunks so autosave only writes the parts that changed.

**Live application:** [writeai-teal.vercel.app](https://writeai-teal.vercel.app)

### Demo account

Sign in with the shared demo account — no registration required:

- **Email:** `animeshkumar.bgs+demo@gmail.com`
- **Password:** `123456aA`

![WriteAI landing page](docs/screenshots/landing.png)

## Features

- **Email/password accounts.** Registration and login with bcrypt-hashed passwords and JWT sessions. The API accepts either an HTTP-only cookie or an `Authorization: Bearer` token, so it works from browsers that drop cross-site cookies.
- **Document dashboard.** Create documents blank or from an AI prompt, rename, delete, and sort by last edited, created date, or title.
- **Markdown editor.** A CodeMirror 6 editor with editor-only and split-preview modes, a formatting toolbar (headings, bold, italic, code block, image), fullscreen, and live word / character / chunk counts.
- **Three AI actions.** *Generate Draft* writes a fresh draft from the title and description, *Rewrite Selection* reworks the current content, and *Custom Prompt* continues the document from your own instruction. Output streams into the editor as it is produced.
- **Autosave that keeps up with the AI.** Edits are debounced and saved automatically; only changed chunks are written. A status pill reports saved / saving / unsaved / failed, `Ctrl`/`Cmd`+`S` saves on demand, and leaving with unsaved work prompts a confirmation.
- **Conflict-aware saving.** If another tab has already changed the same chunk, the save is rejected and you choose whether to keep your version or reload the server's.
- **PDF import.** Upload a PDF to replace a document's contents; the extracted text is re-chunked in place.
- **Background PDF export.** Export is queued and processed off the request path; the editor polls until the file is ready, then downloads it.
- **Full-text search.** Search across document titles and body content with fuzzy matching and highlighted snippets, open from anywhere with `Ctrl`/`Cmd`+`K`, and jump straight to the matching chunk.

## Screenshots

### Dashboard

![Dashboard](docs/screenshots/dashboard.png)

### Editor

![Editor](docs/screenshots/editor.png)

### Search

![Search](docs/screenshots/search.png)

## Tech stack

**Frontend**

- React 19 with Vite 7
- Tailwind CSS 4
- CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-markdown`)
- React Router 7, Axios, `lucide-react`, `react-hot-toast` / `sonner`

**Backend**

- Node.js 20+ and Express 5
- Mongoose 8 over MongoDB Atlas (with Atlas Search)
- `@google/genai` for Gemini generation and embeddings
- BullMQ for the export queue and worker
- `express-rate-limit` + `rate-limit-redis`, Helmet, CORS, `jsonwebtoken`, `bcryptjs`
- `multer` (upload handling), `pdf-parse` (import), PDFKit + `markdown-it` (export)

**Infrastructure**

- Redis — a mandatory runtime dependency backing rate limits, the daily AI quota, AI locks, and BullMQ
- Vercel for the frontend, Render for the Express API (single web service)

## Architecture

**Documents are ordered chunks.** A `Document` holds metadata (title, subtitle, word count); its body lives in `DocumentChunk` records keyed by `(documentId, order)`. Content is split at roughly 4,000 characters on paragraph boundaries, and each chunk carries its own `version` counter. Reading a document reassembles the chunks in `order`; the editor keeps the same shape in memory through a client-side `DocumentModel` that re-splits chunks as they grow past the limit.

**Autosave writes only what changed.** As you type, the `DocumentModel` marks the touched chunks dirty. A debounced save collects the dirty set and sends it to `PATCH /api/documents/:id/chunks/batch` — unchanged chunks are never transmitted, so save payloads and write volume stay flat as a document grows. The dirty flag for a chunk is cleared only if its content still matches what was sent, so an edit made during an in-flight save is never lost.

**Conflicts are detected per chunk.** Each dirty chunk is sent with the client's last-known `version`. The server updates each chunk with a compare-and-swap keyed on that version. If every chunk matches, the batch commits; if any chunk's version has moved on, the batch returns `409` with the current server copies of the conflicting chunks, and the editor resolves it.

**AI generation streams over HTTP.** The editor calls `POST /api/ai/stream` with `fetch` and reads `response.body` through a `ReadableStream` reader, inserting each decoded piece of text at the cursor as it arrives. The create-a-document flow instead calls `POST /api/ai/generate-content`, which returns the finished draft in one response.

## Engineering notes

### Optimistic concurrency control, per chunk

Every `DocumentChunk` has an integer `version`. A batch save carries a `clientVersions` map, and the server turns each entry into an atomic MongoDB compare-and-swap inside `bulkWrite`:

```js
{
  updateOne: {
    filter: { documentId, order, version: clientVersion },
    update: { $set: { content }, $inc: { version: 1 } },
    upsert: false,
  },
}
```

The `version` in the filter is what makes the write conditional: the update matches only if nobody has changed that chunk since the client last read it. When `matchedCount` is short, the server fetches the current state of the sent orders, separates the chunks that actually saved from the ones that didn't, and returns `409` with the conflicting server chunks so the client can show them.

Doing this **per chunk rather than per document** is the point. A single document-level version would treat every concurrent save as a conflict, even edits to completely unrelated paragraphs — including the common case of the AI streaming into one region while autosave flushes another. With a version per chunk, edits to *different* chunks each match their own filter and merge cleanly; only two writes racing on the *same* chunk actually conflict. PDF import leans on the same mechanism: it advances the version of every existing order it replaces, so any editor opened before the import becomes correctly stale on its next save.

Conflict resolution uses a native confirmation dialog:

- **Keep my version** — strip the stale version from the conflicting chunks, force-overwrite once (which bumps the server version), reload, and resume normal version checks.
- **Use the server version** — reload the full server document and discard the local edit.

### Distributed AI lock

Two AI requests for the same document must not run at once — they would interleave into the same text. Before generating, a request takes a Redis lock scoped to the user and document:

```js
redisClient.set(`ai:lock:${userId}:${documentId}`, token, { EX: 180, NX: true });
```

`SET NX` makes acquisition atomic — the second caller gets nothing and is rejected with `409`. The `EX` ensures a crashed or hung request can't hold the lock forever. The lock value is a per-request UUID, and release runs a Lua compare-and-delete rather than a plain `DEL`:

```lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
```

That token check closes the classic expiry race: if request A's lock times out and request B acquires the same key, A finishing later must not delete B's lock. It deletes the key only if the token is still its own.

### Streaming

Generation into the editor is streamed token by token over **chunked HTTP transfer**, not Server-Sent Events. The server responds with `Content-Type: text/plain` and `res.write()`s each piece of model output as it is produced. The client reads the response body incrementally:

```js
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  onChunk(decoder.decode(value, { stream: true }));
}
```

There is no event framing, no `EventSource`, and no reconnection protocol — just a plain response body consumed as a stream. Generation can be cancelled from the client with an `AbortController`.

### Retrieval for Custom Prompt

A *Custom Prompt* runs a small retrieval step so the model sees the most relevant parts of a long document. The server builds a query from the title, the instruction, and the tail of the current content, then embeds that query together with all of the document's chunks using `gemini-embedding-001`. It scores each chunk by cosine similarity against the query, takes the top three, restores their original document order, and injects them as reference context — wrapped so their contents are treated as material to read, not as instructions to follow. Embeddings are computed per request; there is no persistent vector index.

### Background export

Export never blocks the request. `POST /api/exports/:id/pdf` enqueues a BullMQ job and immediately returns `202` with a job ID. A worker renders the document's chunks to a PDF with PDFKit and stores the result on the completed job. The client polls `GET /api/exports/status/:jobId` until the job reports `completed` (or `failed`), then downloads the file from `GET /api/exports/download/:jobId`. Completed and failed jobs are pruned by BullMQ's retention settings.

## Local setup

### Prerequisites

- Node.js 20+ and pnpm 10+
- MongoDB — an Atlas cluster is required for search (see [Atlas Search indexes](#atlas-search-indexes))
- Redis — the backend refuses to start without it
- A Google Gemini API key

### Install

```bash
git clone https://github.com/Animesh-kumar23/WriteAI.git
cd WriteAI
pnpm --dir backend install
pnpm --dir frontend install
```

### Configure and run

The backend and frontend each have a `.env.example` to copy:

```bash
# Terminal 1 — API + export worker
cd backend
cp .env.example .env      # fill in the required values
pnpm dev                  # starts on http://localhost:3000
```

```bash
# Terminal 2 — frontend
cd frontend
cp .env.example .env      # set VITE_API_BASE_URL
pnpm dev                  # starts on http://localhost:5173
```

`backend/src/server.js` connects to MongoDB and Redis, starts the BullMQ export worker, and then begins serving the API — the worker runs inside the same process, so `pnpm dev` is all you need for exports to be processed.

### Backend environment variables

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `DB_URI` | ✅ | — | MongoDB connection string |
| `JWT_SECRET_KEY` | ✅ | — | JWT signing secret |
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API credential |
| `REDIS_URL` | ✅ | — | Redis connection for rate limits, quota, AI locks, and BullMQ |
| `PORT` | — | `3000` | API port |
| `CLIENT_URL` | — | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `AI_DAILY_LIMIT` | — | `100` | Per-user AI requests per UTC day |
| `EMBEDDING_MODEL` | — | `gemini-embedding-001` | Embedding model used for retrieval |

### Frontend environment variables

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `VITE_API_BASE_URL` | ✅ | — | Backend base URL, e.g. `http://localhost:3000` |
| `VITE_SHOW_CONTACT_INFO` | — | `false` | Set to `true` to enable the footer contact links |

### Atlas Search indexes

Search runs on two Atlas Search indexes. Create them in the database referenced by `DB_URI` before using search; a missing index, or one built on the wrong collection, makes `$search` return no results without raising an error.

Collection `documents`, index name `documents_and_chunks`:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "title": { "type": "string", "analyzer": "lucene.standard" },
      "subtitle": { "type": "string", "analyzer": "lucene.standard" }
    }
  }
}
```

Collection `documentchunks`, index name `chunks_content`:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "content": { "type": "string", "analyzer": "lucene.standard", "store": true }
    }
  }
}
```

## Testing

The backend has a Vitest + Supertest integration suite of **13 tests** in [`backend/tests/api.integration.test.js`](backend/tests/api.integration.test.js), run from `backend/`:

```bash
pnpm test
```

The suite refuses to run unless it is pointed at an isolated MongoDB database (name ending in `_test`) and Redis database `15`. It covers:

- Authentication and per-user authorization (401 unauthenticated, 403 cross-user access)
- Per-chunk version round-tripping through save and refetch
- Same-chunk stale saves returning `409` with conflict data
- Edits to different chunks merging without conflict
- "Keep mine" force-overwrite bumping the version and resuming conflict checks
- PDF import advancing versions for the orders it replaces
- Content-only search resolving to the owning document
- The AI lock rejecting a second generation on the same document while allowing concurrent generation on different documents
- The daily AI quota returning `429` when exhausted
- Export enqueuing an owned document and returning a job ID

One additional test issues a real Atlas Search `$search` query; it is skipped unless `ATLAS_SEARCH_TEST_URI` points at a cluster with the indexes above, because MongoDB Community has no Atlas Search.

## License and attribution

[Apache 2.0](LICENSE). See [NOTICE](NOTICE) for retained notices.

Initial data models and auth scaffolding were adapted from [Imprintly](https://github.com/KeepSerene/imprintly-ai-e-book-creator-mern) (Apache 2.0). Substantially modified: chunk-based storage, optimistic concurrency control, streaming AI generation, Redis locking, background export jobs, and retrieval were built for this project.
