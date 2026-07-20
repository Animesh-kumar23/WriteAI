# WriteAI

> A focused AI document editor built around chunk-based persistence, optimistic concurrency control, HTTP streaming, retrieval, and queued PDF exports.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-writeai--teal.vercel.app-7c3aed?style=flat-square&logo=vercel&logoColor=white)](https://writeai-teal.vercel.app)
[![CI](https://github.com/Animesh-kumar23/WriteAI/actions/workflows/ci.yml/badge.svg)](https://github.com/Animesh-kumar23/WriteAI/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Required-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![BullMQ](https://img.shields.io/badge/BullMQ-Queue-FF4F64?style=flat-square)](https://docs.bullmq.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

**Live application:** [writeai-teal.vercel.app](https://writeai-teal.vercel.app)

### Demo account

- Email: `animeshkumar.bgs+demo@gmail.com`
- Password: `123456aA`

![WriteAI landing page](docs/screenshots/landing.png)

## What it does

WriteAI keeps the product surface intentionally small while retaining the engineering-heavy paths:

- Email/password signup and login with bcrypt password hashing and JWT authentication. Protected API routes accept the HTTP-only cookie or a Bearer token.
- A dashboard for creating, renaming, sorting, opening, and deleting documents, including create-from-scratch AI generation.
- A dark-only, single-page CodeMirror 6 Markdown editor with edit/split-preview modes, formatting controls, debounced autosave, `Ctrl+S`, save status, and an unsaved-change guard.
- Three AI actions: Generate Draft, Rewrite Selection, and Custom Prompt.
- Token-by-token AI streaming over chunked HTTP transfer (`fetch` + ReadableStream reader).
- PDF-only import and asynchronous PDF export.
- MongoDB Atlas Search across document titles and chunk content.
- A read-only account menu showing the signed-in user's name and email.

Both AI endpoints are deliberate. `/api/ai/generate-content` returns a completed result for the create-document flow, while `/api/ai/stream` incrementally updates the in-editor experience.

## Screenshots

### Dashboard

![Dashboard](docs/screenshots/dashboard.png)

### Editor

![Editor](docs/screenshots/editor.png)

### Search

![Search](docs/screenshots/search.png)

## Architecture

| Layer | Responsibility |
|---|---|
| React 19 + Vite | Dashboard, CodeMirror editor, dirty-chunk tracking, streaming response reader, export polling |
| Express 5 | REST API, JWT auth, validation, CORS, Helmet, Redis-backed rate limiting |
| MongoDB + Mongoose | Documents, ordered chunks, compare-and-swap saves, Atlas Search |
| Redis | Mandatory runtime dependency for rate limits, AI quotas, AI locks, and BullMQ |
| BullMQ worker | Consumes PDF export jobs and returns generated files through job results |
| Gemini | `gemini-2.5-flash` generation and `gemini-embedding-001` embeddings |

The API connects to MongoDB and Redis before it loads the Express app. A missing Redis connection is therefore a startup failure by design. `server.js` starts the BullMQ worker alongside the API.

## Engineering highlights

### Dirty-chunk saves and optimistic concurrency

Documents are stored as ordered `DocumentChunk` records. The client-side `DocumentModel` tracks which chunks changed and autosave sends only that dirty set, reducing payload and write volume as documents grow. This dirty tracking is also part of the concurrency design and is intentionally retained.

Each persisted chunk carries a version. Batch saves use MongoDB compare-and-swap filters inside `bulkWrite`: edits from stale tabs receive `409`, while changes to different chunks can still merge. PDF import advances versions for existing chunk orders so tabs opened before an import become stale correctly.

The conflict UI uses the browser's native confirmation dialog:

- **OK — keep my version:** force-overwrite the conflicted chunk once, increment its server version, reload, and resume ordinary version checks.
- **Cancel — use the server version:** reload the complete server document.

### Streaming AI and retrieval

Editor generation uses chunked HTTP transfer. The browser reads `response.body` with a `ReadableStream` reader and inserts decoded text as it arrives.

Custom Prompt requests use a compact retrieval path. The server embeds the query and all owned document chunks, computes cosine similarity directly, selects the top three, restores their document order, and injects them as reference context. Retrieval is always active for this path; there is no feature flag or cache fallback.

### Redis coordination and limits

Three Redis-backed limiters cover global traffic, authentication attempts, and per-user AI traffic. A separate daily AI quota expires at the next UTC midnight.

AI requests also acquire a Redis `SET NX EX` lock scoped to user and document. Each acquisition has a unique token, and release uses an atomic Lua compare-and-delete script. That ownership check is intentionally retained so a slow request cannot release a newer request's lock.

### Background PDF export

The export endpoint enqueues a BullMQ job and immediately returns its ID. The client polls job status, then downloads the PDF after the worker completes. Completed and failed jobs use BullMQ's bounded retention settings; the pipeline has no application-level result cache, retry policy, or export-specific rate limiter.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, CodeMirror 6, Axios |
| Backend | Node.js 20+, Express 5, Mongoose 8 |
| Data | MongoDB Atlas, MongoDB Atlas Search |
| Coordination | Redis, `rate-limit-redis`, BullMQ |
| AI | Google Gemini 2.5 Flash, Gemini embeddings, cosine similarity RAG |
| Files | PDFKit export, `pdf-parse` import, Multer upload handling |
| Auth and security | JWT, bcryptjs, Helmet, CORS |
| Tests | Vitest and Supertest backend integration tests |
| Deployment | Vercel frontend, Render backend |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 10+
- MongoDB; Atlas Search indexes are required for the search feature
- Redis; the backend will not boot without it
- A Google Gemini API key

### Atlas Search indexes

Create these Atlas Search indexes in the database named by `DB_URI` before starting the backend:

- Collection `documents`, index `documents_and_chunks`: `{"mappings":{"dynamic":false,"fields":{"title":{"type":"string","analyzer":"lucene.standard"},"subtitle":{"type":"string","analyzer":"lucene.standard"}}}}`
- Collection `documentchunks`, index `chunks_content`: `{"mappings":{"dynamic":false,"fields":{"content":{"type":"string","analyzer":"lucene.standard","store":true}}}}`

A missing index or an index created on the wrong collection can make Atlas Search return an empty result set without an error.

Clone and install:

```bash
git clone https://github.com/Animesh-kumar23/WriteAI.git
cd WriteAI
pnpm --dir backend install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
```

Configure and start the backend:

```bash
cd backend
cp .env.example .env
# Fill in the required values, then:
pnpm dev
```

In another terminal, configure and start the frontend:

```bash
cd frontend
cp .env.example .env
pnpm dev
```

The frontend defaults to port `5173`; the backend defaults to port `3000`.

### Environment variables

`backend/.env`:

| Variable | Required | Purpose |
|---|---:|---|
| `DB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET_KEY` | Yes | JWT signing secret |
| `GEMINI_API_KEY` | Yes | Gemini API credential |
| `REDIS_URL` | Yes | Redis connection used by limits, quotas, locks, and BullMQ |
| `PORT` | No | API port; defaults to `3000` |
| `CLIENT_URL` | No | Comma-separated CORS origins; defaults to `http://localhost:5173` |
| `AI_DAILY_LIMIT` | No | Per-user daily AI allowance; defaults to `100` |
| `EMBEDDING_MODEL` | No | Retrieval embedding model; defaults to `gemini-embedding-001` |

`frontend/.env`:

| Variable | Required | Purpose |
|---|---:|---|
| `VITE_API_BASE_URL` | Yes | Backend base URL, for example `http://localhost:3000` |
| `VITE_SHOW_CONTACT_INFO` | No | Enables live footer contact links when set to `true` |

## API surface

| Prefix | Main operations |
|---|---|
| `/api/auth` | Register, login, logout, current user |
| `/api/documents` | CRUD, chunk reads/batch saves, PDF import, Atlas Search |
| `/api/ai` | Completed create-flow generation and streamed editor generation |
| `/api/exports` | Enqueue PDF, poll status, download result, queue stats |

## Testing

The retained backend integration suite uses Vitest and Supertest. Frontend tests were removed as part of the scope reduction. Run backend tests from `backend/` when working on that suite:

```bash
pnpm test
```

## Deployment

The frontend is deployed on Vercel and the Express API is deployed on Render. The API serves no frontend assets. The checked-in [`render.yaml`](render.yaml) defines the backend service and its required secrets; its start command launches both the API and the export worker.

## Project structure

```text
WriteAI/
├── backend/src/
│   ├── configs/       # environment, MongoDB, Redis, Gemini
│   ├── controllers/   # auth, documents, AI, exports, import, search
│   ├── middlewares/   # auth, upload, rate limits, daily quota
│   ├── models/        # User, Document, DocumentChunk
│   ├── queues/        # BullMQ export queue
│   ├── services/      # cosine-similarity retrieval
│   ├── workers/       # PDF export worker
│   └── utils/         # PDF, import, chunks, Redis AI lock
├── frontend/src/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/           # documentModel, stream reader, Axios
│   └── pages/
├── docs/screenshots/
├── NOTICE
└── render.yaml
```

## License and attribution

[Apache 2.0](LICENSE). See [NOTICE](NOTICE) for retained notices.

Initial data models and auth scaffolding were adapted from [Imprintly](https://github.com/KeepSerene/imprintly-ai-e-book-creator-mern) (Apache 2.0). Substantially modified: chunk-based storage, optimistic concurrency control, streaming AI generation, Redis locking, background export jobs, and retrieval were built for this project.
