const Document = require("../models/document");
const DocumentChunk = require("../models/DocumentChunk");
const ENV = require("../configs/env");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSnippet(content, query) {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return { snippet: content.slice(0, 120), matchStart: -1, matchEnd: -1 };
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 60);
  return {
    snippet: content.slice(start, end),
    matchStart: idx - start,
    matchEnd: idx - start + query.length,
  };
}

async function searchDocuments(req, res) {
  const q = req.query.q?.trim();

  if (!q || q.length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters." });
  }

  const limit = Math.min(parseInt(req.query.limit) || 10, 20);

  try {
    let titleResults = [];
    let chunkResults = [];

    if (ENV.ATLAS_SEARCH_ENABLED) {
      // --- Atlas Search path (production) ---
      titleResults = await Document.aggregate([
        {
          $search: {
            index: "documents_and_chunks",
            text: { query: q, path: ["title", "subtitle"], fuzzy: { maxEdits: 1 } },
          },
        },
        { $match: { userId: req.user.id } },
        { $limit: limit },
        { $addFields: { score: { $meta: "searchScore" } } },
        { $project: { title: 1, subtitle: 1, coverImage: 1, score: 1 } },
      ]);

      const userDocIds = titleResults.map((d) => d._id);

      if (userDocIds.length > 0) {
        const rawChunkResults = await DocumentChunk.aggregate([
          {
            $search: {
              index: "chunks_content",
              text: { query: q, path: "content", fuzzy: { maxEdits: 1 } },
              highlight: { path: "content" },
            },
          },
          { $match: { documentId: { $in: userDocIds } } },
          { $limit: 50 },
          {
            $project: {
              documentId: 1,
              order: 1,
              content: 1,
              highlights: { $meta: "searchHighlights" },
              score: { $meta: "searchScore" },
            },
          },
        ]);

        chunkResults = rawChunkResults;
      }
    } else {
      // --- Regex fallback path (local dev / non-Atlas) ---
      titleResults = await Document.find(
        { userId: req.user.id, $text: { $search: q } },
        { score: { $meta: "textScore" }, title: 1, subtitle: 1, coverImage: 1 }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .lean();

      const sanitizedQ = escapeRegex(q);
      const userDocIds = await Document.find(
        { userId: req.user.id },
        { _id: 1 }
      ).lean();

      chunkResults = await DocumentChunk.find(
        {
          documentId: { $in: userDocIds.map((d) => d._id) },
          content: { $regex: sanitizedQ, $options: "i" },
        },
        { documentId: 1, order: 1, content: 1 }
      )
        .limit(50)
        .lean();
    }

    // --- Build result map keyed by documentId ---
    const resultMap = new Map();

    // Seed with title matches
    titleResults.forEach((doc) => {
      const key = doc._id.toString();
      resultMap.set(key, {
        documentId: key,
        title: doc.title,
        subtitle: doc.subtitle,
        coverImage: doc.coverImage,
        titleMatch: true,
        chunkMatches: [],
      });
    });

    // Fetch metadata for docs only found via chunk matches
    const chunkDocIds = [...new Set(chunkResults.map((c) => c.documentId.toString()))];
    const missingDocIds = chunkDocIds.filter((id) => !resultMap.has(id));

    if (missingDocIds.length > 0) {
      const missingDocs = await Document.find(
        { _id: { $in: missingDocIds }, userId: req.user.id },
        { title: 1, subtitle: 1, coverImage: 1 }
      ).lean();

      missingDocs.forEach((doc) => {
        resultMap.set(doc._id.toString(), {
          documentId: doc._id.toString(),
          title: doc.title,
          subtitle: doc.subtitle,
          coverImage: doc.coverImage,
          titleMatch: false,
          chunkMatches: [],
        });
      });
    }

    // Attach chunk matches
    chunkResults.forEach((chunk) => {
      const key = chunk.documentId.toString();
      const entry = resultMap.get(key);
      if (!entry) return;

      if (ENV.ATLAS_SEARCH_ENABLED && chunk.highlights?.length) {
        // Use Atlas highlight texts
        const highlight = chunk.highlights[0];
        const snippetParts = highlight.texts ?? [];
        const snippet = snippetParts.map((t) => t.value).join("");
        const hitPart = snippetParts.find((t) => t.type === "hit");
        const matchStart = snippet.indexOf(hitPart?.value ?? q);
        entry.chunkMatches.push({
          order: chunk.order,
          snippet,
          matchStart,
          matchEnd: matchStart + (hitPart?.value?.length ?? q.length),
        });
      } else {
        const { snippet, matchStart, matchEnd } = extractSnippet(chunk.content, q);
        entry.chunkMatches.push({ order: chunk.order, snippet, matchStart, matchEnd });
      }
    });

    // Sort: title matches first, then chunk-only matches
    const results = [...resultMap.values()].sort((a, b) => {
      if (a.titleMatch && !b.titleMatch) return -1;
      if (!a.titleMatch && b.titleMatch) return 1;
      return 0;
    });

    return res.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ error: "Search failed." });
  }
}

module.exports = { searchDocuments };
