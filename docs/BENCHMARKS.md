# Chunked autosave — benchmark

WriteAI stores a document as ordered chunks instead of one big blob, so an
autosave only writes the chunk the writer actually touched. This page measures
what that design decision is worth, by running the same edits twice: once with
chunking on, once with the document stored as a single chunk.

Everything below was produced by
[backend/benchmarks/chunking-benchmark.js](../backend/benchmarks/chunking-benchmark.js).
The raw numbers are in
[backend/benchmarks/results.json](../backend/benchmarks/results.json).

## Headline numbers

On a 200 KB document (roughly a 30,000-word draft):

- **98% smaller autosave requests** — 201 KB sent per save becomes 4 KB.
- **28% faster autosave** at p50 (37.3 ms → 26.7 ms), 27% faster at p95.
- **Spurious save conflicts eliminated** — two tabs editing different sections
  of the same document went from 100% of the second saves rejected to 0%.
- **Costs 2.5 ms on document open** — 23.4 ms → 25.9 ms for reading 52 chunk
  documents instead of 1. That is the price paid, once per open, for the
  three wins above, which are paid back every few seconds.

## What the two configurations are

| | Chunks per document | What one autosave sends |
| --- | --- | --- |
| **Chunked** (what WriteAI ships) | one per 4,000 characters | the single edited chunk |
| **No chunking** | one, holding the whole document | the entire document |

The 4,000 figure is `targetChunkCharacters` from
[config/chunkLimits.json](../config/chunkLimits.json) — the same value the app
uses in production.

## How to run it

You need MongoDB and Redis running locally (the same ones the test suite uses).

```bash
pnpm --dir backend bench
```

It prints the tables below and rewrites `backend/benchmarks/results.json`.

## How it was measured

- **The real thing, not a model of it.** The benchmark boots the actual Express
  app, listens on a real port, and sends real HTTP requests to the real
  `PATCH /api/documents/:id/chunks/batch` endpoint, which writes to a real
  MongoDB. No mocks, and nothing in `backend/src/` is modified or branched. The
  *only* difference between the two arms is how many chunks the document was
  split into when it was seeded.
- **The same edit, in the same place.** Each iteration picks one character
  offset in the document and types five characters there. Chunked mode finds
  the chunk that owns that offset and sends only it — the same rule the editor
  uses in [`documentModel.js`](../frontend/src/lib/documentModel.js). No-chunking
  mode has only one chunk to send, so it sends everything.
- **The two arms are interleaved.** They take turns, one save each, alternating
  which goes first. This matters more than it sounds: a laptop is a noisy place
  to measure, and running one arm to completion before starting the other lets
  a slow minute land entirely on one of them. Taking turns makes any slowdown
  hit both.
- **Warmed up first.** 20 throwaway saves before anything is recorded, then 10
  more per document size, because Node is slowest on its first passes through
  new code.
- **50 measured saves per size**, reported as median (p50) and 95th percentile.
- **Deterministic inputs.** The document text and the sequence of edit positions
  come from a fixed seed, so both arms see identical work and reruns are
  comparable.
- **Isolated.** It runs against `writeai_bench_test` and Redis database 15, and
  refuses to start otherwise.

Measured on Windows 11, Node v26.1.0, with MongoDB and Redis on localhost.
Absolute milliseconds depend on the machine; the *ratios* are what carry over.
Across repeated runs, the 200 KB p50 reduction stayed between 25% and 29%.

## Results

Recorded 2026-08-20.

### Autosave payload — bytes sent per save

| Document | No chunking | Chunked | Reduction |
| --- | --- | --- | --- |
| 10 KB | 10.3 KB | 3.7 KB | **64.0%** |
| 50 KB | 50.5 KB | 4.0 KB | **92.1%** |
| 200 KB | 201.3 KB | 4.0 KB | **98.0%** |

The chunked column barely moves, because a chunk is a chunk no matter how long
the document is. That is the whole point: autosave cost stops tracking document
length.

Over a 30-save editing session on the 200 KB document, that is **5.9 MB
uploaded versus 120 KB**.

### Autosave latency — 50 saves per size

| Document | No chunking (p50 / p95) | Chunked (p50 / p95) | p50 reduction |
| --- | --- | --- | --- |
| 10 KB | 10.7 / 13.4 ms | 10.5 / 13.1 ms | 1.9% |
| 50 KB | 13.0 / 16.2 ms | 11.7 / 15.5 ms | 10.0% |
| 200 KB | 37.3 / 45.9 ms | 26.7 / 33.7 ms | **28.4%** |

The gap widens with document size, which is the expected shape: the saved work
is parsing, transferring and writing the bytes that did not change.

These numbers are from localhost, where transferring 200 KB is nearly free. On
a real connection the payload column above is the one that decides how long a
save takes, so the latency win in production is larger than what is shown here.

### Document open — `GET /chunks`

This is the cost side of the trade, so it belongs in the table too.

| Document | No chunking | Chunked | Chunk documents read |
| --- | --- | --- | --- |
| 10 KB | 5.8 ms | 6.1 ms | 3 |
| 50 KB | 6.4 ms | 7.2 ms | 13 |
| 200 KB | 23.4 ms | 25.9 ms | 52 |

Reading 52 documents instead of 1 costs a couple of milliseconds: the query
walks the compound index on `{ documentId, order }`, and the total bytes
returned are the same either way. Opening a document happens once; autosave
happens every few seconds.

### Concurrent edits to different sections

Ten times over, two tabs open the same 50 KB document, one edits near the
start, the other edits near the end, and both save. The edits never overlap in
the text.

| | Second save rejected |
| --- | --- |
| No chunking | **10 / 10 (100%)** |
| Chunked | **0 / 10 (0%)** |

Without chunking every edit touches the one and only chunk, so the second
writer's version number is always stale and the save is refused — even though
the two people were nowhere near each other in the document. With chunking the
version check is per chunk, so it only fires when two people really are editing
the same passage.

## What chunking does not improve

Worth stating plainly, since the benchmark measured it:

- **Small documents.** At 10 KB the latency difference is 1.9%, inside the
  noise. Chunking earns its keep on long documents.
- **Opening a document.** The whole document still has to be read and sent;
  chunking splits that work up, it does not remove it.
- **Server-side word count.** Every save recomputes the document's word count
  by reading all of its chunks, so that part of the request cost still scales
  with document length in both configurations. It is the main reason the
  latency win (28%) is smaller than the payload win (98%).
