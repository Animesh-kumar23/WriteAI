# WriteAI

> AI-powered document editor built on chunk-based storage, streaming generation, and async export jobs.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-writeai--teal.vercel.app-7c3aed?style=flat-square&logo=vercel&logoColor=white)](https://writeai-teal.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Cloud-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![BullMQ](https://img.shields.io/badge/BullMQ-Queue-FF4F64?style=flat-square)](https://docs.bullmq.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

**[→ writeai-teal.vercel.app](https://writeai-teal.vercel.app)**

![WriteAI landing page](docs/screenshots/landing.png)

---

## Why I Built This

I wanted to move beyond tutorial CRUD apps and build something that forced me to solve real engineering problems: large-document performance, concurrent edits, async background work, rate limiting, and AI cost control. What started as a simple save-the-whole-document approach kept breaking as documents grew — so I refactored into a chunk-based architecture, added conflict detection, moved exports off the request thread into a job queue, and built rate limiting that degrades gracefully when Redis is unavailable. This project is where I learned what production-oriented backend engineering actually looks like.

---

## Architecture

```
┌──────────────────────────────────────────┐
│           Browser (React 19)            │
│  CodeMirror 6 editor · streamed AI responses │
└───────────────────┬──────────────────────┘
                    │ REST / SSE
         ┌──────────▼──────────┐
         │    Express 5 API    │
         │  JWT · Helmet · CORS│
         └──┬──────┬──────┬───┘
            │      │      │
   ┌────────▼──┐ ┌─▼────┐ ┌▼───────────────┐
   │  MongoDB  │ │Redis │ │ Gemini 2.5 Flash│
   │  Chunks   │ │Locks │ │    (AI)         │
   │  + Search │ │Quota │ └────────────────┘
   └───────────┘ │Rate  │
                 └──┬───┘
             ┌──────▼──────┐
             │   BullMQ    │
             │Export Worker│
             └──────┬──────┘
                    │ result → Redis (short TTL)
                    ▼
             Browser download
```

Documents are stored as ordered `DocumentChunk` records in MongoDB. The editor tracks which chunks are dirty and sends only those on autosave. Exports run off-thread in a BullMQ worker. Redis handles AI concurrency locks, rate limiting, daily quotas, and temporary export results.

---

## Features

### ✍️ Writing Experience
- CodeMirror 6 markdown editor with live split preview
- Chunk-based autosave — only changed sections are written to the DB
- Save states: saved / saving / dirty / error, with a persistent status bubble
- `Ctrl+S` save shortcut, inline title editing in the header, and a leave-guard (browser close + in-app nav) when there are unsaved changes
- Import PDF or DOCX — text extracted and replaced into chunks; spinner feedback on the action button
- Export to styled PDF or DOCX via background queue; export dropdown locks while a job is in flight
- Full-text search across documents and chunk content
- Dashboard with client-side sort (last edited / created / title), inline rename via a per-card 3-dot menu, and "Edited Nago · ~N words" metadata cached on every save

### 🤖 AI Writing (Gemini 2.5 Flash)
- 8 actions: Generate Draft, Continue, Rewrite, Expand, Shorten, Fix Grammar, Simplify, Custom Prompt
- Streams tokens to the editor in real time via chunked HTTP transfer
- Configurable style, tone, audience, format, and length
- Per-document lock prevents duplicate AI requests across tabs

### 🏗️ Infrastructure
- Chunk-based document storage with lazy loading in read view
- Version-per-chunk conflict detection — 409 on mismatch, resolution modal in UI
- Background export jobs (BullMQ) — non-blocking, retryable, cached in Redis
- Multi-tier rate limiting: global, per-user, AI-specific, export-specific
- Daily AI quota with automatic UTC midnight reset
- Atlas Search with fuzzy matching (regex fallback in dev)
- ZIP bomb detection on DOCX import
- Graceful degradation when Redis is unavailable

---

## Screenshots

### Dashboard — document library with AI-assisted creation
![Dashboard](docs/screenshots/dashboard.png)

### Editor — markdown editing with streaming AI actions
![Editor](docs/screenshots/editor.png)

### Search — fuzzy search across document titles and chunk content
![Search](docs/screenshots/search.png)

---

## Engineering Challenges

### Chunk-based document architecture

The naive approach writes the entire document on every save. For long documents, that's wasteful — and it gets worse as documents grow. I split documents into ordered chunks with a `DocumentModel` class on the client that tracks which chunks are dirty. On autosave, only the changed chunks are sent in a single batch request. Clean separation between "what changed" and "what didn't."

### Concurrent edit conflict detection

Every chunk carries a version counter. When the client saves, it sends the version it last saw for each chunk. The server does a conditional update: if the server version no longer matches, the update fails and a 409 is returned with the conflicted chunk data. The editor shows a modal — "Keep Mine" forces an overwrite, "Use Server" resets the editor to the server state. Conflicts are resolved at the chunk level, not the full document.

### Background export jobs

PDF and DOCX generation is slow — parsing markdown, rendering fonts, embedding images. Running that on the request thread would block the API. I moved it into a BullMQ worker: the client gets a job ID immediately, then polls for status. When the worker finishes, it stores the result in Redis with a short TTL. The client fetches it for download. Jobs retry with exponential backoff on failure.

### AI concurrency control

Submitting the same AI request twice wastes API quota and creates race conditions in the editor. Before each Gemini call, the server acquires a Redis lock scoped to user + document. If the lock already exists, the request is rejected with 409. The lock expires automatically if the stream crashes, so it never gets permanently stuck. Users can still run AI generation on two different documents simultaneously.

### Security

| Threat | Mitigation |
|---|---|
| Path traversal | `coverImage` and `avatar` are only writable via dedicated multer upload endpoints — never via JSON body |
| Prompt injection | All AI config fields are sanitized (HTML stripped, length-capped) before insertion into Gemini prompts |
| CSRF | CORS origin whitelist + JSON-only request bodies (form-based attacks can't replicate `application/json`); `httpOnly` cookie prevents XSS token theft |
| XSS | `rehype-sanitize` in markdown preview; `escapeHtml` runs before all renderer substitutions |
| Zip bomb on import | `adm-zip` checks uncompressed entry sizes before parsing — oversized archives are rejected |
| NoSQL injection | All Mongoose queries use typed parameters; malformed ObjectIds return 400 before hitting the DB |

---

## What I Learned

Building WriteAI taught me how quickly simple architectures break under real usage.

The biggest lessons:
- Naive full-document saves don't scale — granular writes matter
- Background jobs are necessary for any work that takes more than a second
- Concurrency bugs appear fast when autosave, AI generation, and multiple tabs run simultaneously
- Rate limiting and cost controls are first-class requirements in AI products, not afterthoughts

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, CodeMirror 6, Axios |
| Backend | Node.js, Express 5, Mongoose 8 |
| Database | MongoDB (Atlas in prod) |
| Queue | BullMQ |
| Cache / Locks | Redis (Redis Cloud in prod) |
| AI | Google Gemini 2.5 Flash |
| Export | PDFKit, docx |
| Import | Mammoth, pdf-parse |
| Auth | JWT, bcryptjs |
| Security | helmet, express-rate-limit, multer |
| Infra | Vercel (frontend), Render (backend) |

---

## Getting Started

**Prerequisites:** Node.js 20+, MongoDB, Redis (optional — features degrade gracefully without it)

```bash
git clone https://github.com/Animesh-kumar23/WriteAI.git
cd WriteAI
```

### Backend

```bash
cd backend
cp .env.example .env   # fill in DB_URI, JWT_SECRET_KEY, GEMINI_API_KEY
pnpm install
pnpm dev
```

### Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:3000
pnpm install
pnpm dev
```

### Environment Variables

**`backend/.env`**

| Variable | Required | Notes |
|---|---|---|
| `DB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET_KEY` | ✅ | JWT signing secret |
| `GEMINI_API_KEY` | ✅ | Google AI key |
| `CLIENT_URL` | ✅ | Comma-separated frontend origins for CORS |
| `REDIS_URL` | No | Enables rate limiting, locks, and export cache |
| `AI_DAILY_LIMIT` | No | Max AI calls per user per day (default: 100) |
| `ATLAS_SEARCH_ENABLED` | No | `true` to use fuzzy Atlas Search in prod |

**`frontend/.env`**

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | Backend URL (e.g. `http://localhost:3000`) |
| `VITE_SHOW_CONTACT_INFO` | No | `true` to show real contact details in footer |

---

## Deployment

The frontend and backend are deployed separately:

| Service | Platform | URL |
|---|---|---|
| React frontend | [Vercel](https://vercel.com) | [writeai-teal.vercel.app](https://writeai-teal.vercel.app) |
| Express API | [Render](https://render.com) | writeai-1jcj.onrender.com |

The backend is API-only (no static file serving). CORS allows both Vercel origins. A `render.yaml` Blueprint is included in the repo root for one-click Render deploy.

---

## Project Structure

```
writeai/
├── backend/src/
│   ├── configs/       # db, redis, env
│   ├── controllers/   # auth, documents, ai, exports, import, search, profile
│   ├── middlewares/   # auth, upload, rateLimit, aiQuota
│   ├── models/        # User, Document, DocumentChunk
│   ├── queues/        # export.queue.js (BullMQ)
│   ├── workers/       # export.worker.js
│   ├── routes/
│   └── utils/         # pdf.generator, docx.generator, import.parser, documentChunks
│
└── frontend/src/
    ├── components/    # edit-document, document-view, home, ui
    ├── contexts/      # AuthContext, ThemeContext
    ├── hooks/         # useDocumentEditor, useDocumentChunks, useSearch
    ├── lib/           # documentModel.js, aiStream.js, axios.js
    └── pages/         # Dashboard, EditDocument, Document, Landing, Profile, Auth
```

---

## License

[Apache 2.0](LICENSE)
