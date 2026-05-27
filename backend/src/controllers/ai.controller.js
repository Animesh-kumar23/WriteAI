const { GoogleGenAI } = require("@google/genai");
const ENV = require("../configs/env");
const { redisClient } = require("../configs/redis");

async function withRetry(fn, retries = 2, baseDelay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries && err.status === 503) {
        await new Promise((r) => setTimeout(r, baseDelay * (i + 1)));
      } else {
        throw err;
      }
    }
  }
}

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

/**
 * Basic input sanitization.
 * Removes excessive special characters and limits length.
 */
function sanitizeInput(input, maxLength = 500) {
  if (!input) return "";

  let sanitized = input.trim().slice(0, maxLength);

  // remove any potential script tags or HTML
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<[^>]+>/g, "");

  return sanitized;
}

async function streamAIContent(req, res) {
  // --- Validation (before acquiring any lock) ---
  const {
    action = "generate",
    documentId,
    documentTitle,
    documentDescription = "",
    existingContent = "",
    customPrompt = "",
    aiConfig = {},
  } = req.body;

  const {
    style = "Professional",
    tone = [],
    audience = "",
    format = "",
    length = "",
    extraInstructions = "",
  } = aiConfig;

  if (!documentTitle && action === "generate") {
    return res.status(400).json({ error: "Document title is missing!" });
  }

  const safeDocumentTitle = sanitizeInput(documentTitle, 300);
  const safeDocumentDescription = sanitizeInput(documentDescription, 600);
  const safeStyle = sanitizeInput(style, 50);
  const safeAudience = sanitizeInput(audience, 100);
  const safeFormat = sanitizeInput(format, 100);
  const safeLength = sanitizeInput(length, 50);
  const safeExtraInstructions = sanitizeInput(extraInstructions, 500);
  const safeTone = Array.isArray(tone)
    ? tone.slice(0, 10).map((t) => sanitizeInput(String(t), 30)).join(", ") || "None"
    : "None";
  const safeExistingContent = sanitizeInput(existingContent, 12000);
  const safeCustomPrompt = sanitizeInput(customPrompt, 1500);

  let prompt = "";

  try {

    switch (action) {
      case "generate":
        prompt = `You are an expert AI writing assistant.

Generate polished markdown content.

Title: ${safeDocumentTitle}
Description: ${safeDocumentDescription}
Style: ${safeStyle}
Tone: ${safeTone}
Audience: ${safeAudience || "General"}
Format: ${safeFormat || "Freeform"}
Length: ${safeLength || "Medium"}
Instructions: ${safeExtraInstructions || "None"}
`;
        break;

      case "continue":
        prompt = `You are an expert AI writing assistant.

Continue the following document naturally.

Title: ${safeDocumentTitle}${safeDocumentDescription ? `\nDescription: ${safeDocumentDescription}` : ""}

<existing_content>
${safeExistingContent}
</existing_content>

IMPORTANT:
1. Continue seamlessly from where the content ends
2. Do NOT repeat existing content
3. Match the existing tone, style, and format
4. Return ONLY the continuation text`;
        break;

      case "rewrite":
        prompt = `Rewrite while preserving meaning:

${safeExistingContent}`;
        break;

      case "expand":
        prompt = `Expand this content with more detail:

${safeExistingContent}`;
        break;

      case "shorten":
        prompt = `Shorten this content while preserving meaning:

${safeExistingContent}`;
        break;

      case "grammar":
        prompt = `Fix grammar only:

${safeExistingContent}`;
        break;

      case "simplify":
        prompt = `Simplify this content:

${safeExistingContent}`;
        break;

      case "custom":
        prompt = `You are an expert AI writing assistant.

Continue the document following the user's specific instructions.

Title: ${safeDocumentTitle}${safeDocumentDescription ? `\nDescription: ${safeDocumentDescription}` : ""}

<existing_content>
${safeExistingContent}
</existing_content>

<user_instruction>
${safeCustomPrompt}
</user_instruction>

IMPORTANT:
1. Write new text that continues from where the content ends
2. Do NOT repeat existing content
3. Follow the user's instruction precisely
4. Match the existing tone, style, and format
5. Return ONLY the new continuation text`;
        break;

      default:
        return res.status(400).json({ error: "Invalid AI action!" });
    }
  } catch (error) {
    // Catches errors during prompt building (shouldn't happen, but just in case)
    console.error("Streaming AI error (prompt phase):", error);
    return res.status(500).json({ error: "Streaming failed" });
  }

  // --- Per-document concurrency lock ---
  // Scoped to document when documentId is provided so a user working across
  // multiple documents in parallel isn't blocked. Falls back to per-user key
  // if no documentId (e.g. initial document creation flow).
  const lockKey = documentId
    ? `ai:lock:${req.user.id}:${documentId}`
    : `ai:lock:${req.user.id}`;
  let lockAcquired = false;

  if (redisClient) {
    try {
      const acquired = await redisClient.set(lockKey, "1", { EX: 120, NX: true });
      if (!acquired) {
        return res.status(409).json({
          error: "A generation is already in progress. Please wait.",
        });
      }
      lockAcquired = true;
    } catch {
      // Redis temporarily unavailable — allow the request without a lock
    }
  }

  // --- Stream with guaranteed lock cleanup ---
  try {
    // Open stream BEFORE sending headers so Gemini errors (503 etc) return proper JSON
    const stream = await withRetry(() =>
      ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
      })
    );

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(text);
      }
    }

    res.end();
  } catch (error) {
    console.error("Streaming AI error:", error);

    if (!res.headersSent) {
      if (error.status === 503) {
        return res.status(503).json({
          error: "AI model is busy. Please try again in a moment.",
        });
      }
      return res.status(500).json({ error: "Streaming failed" });
    }

    res.end();
  } finally {
    if (lockAcquired) {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
}


async function generateDocumentContent(req, res) {
  // --- Validation (before acquiring any lock) ---
  const {
    action = "generate",
    documentId,
    documentTitle,
    documentDescription = "",
    existingContent = "",
    customPrompt = "",
    aiConfig = {},
  } = req.body;

  const {
    style = "Professional",
    tone = [],
    audience = "",
    format = "",
    length = "",
    extraInstructions = "",
  } = aiConfig;

  const allowedActions = [
    "generate", "continue", "rewrite", "expand",
    "shorten", "grammar", "simplify", "custom",
  ];

  if (!documentTitle) {
    return res.status(400).json({ error: "Document title is missing!" });
  }

  if (!allowedActions.includes(action)) {
    return res.status(400).json({ error: "Invalid AI action!" });
  }

  const safeDocumentTitle = sanitizeInput(documentTitle, 300);
  const safeDocumentDescription = sanitizeInput(documentDescription, 600);
  const safeStyle = sanitizeInput(style, 50);
  const safeAudience = sanitizeInput(audience, 100);
  const safeFormat = sanitizeInput(format, 100);
  const safeLength = sanitizeInput(length, 50);
  const safeExtraInstructions = sanitizeInput(extraInstructions, 500);
  const safeTone = Array.isArray(tone)
    ? tone.slice(0, 10).map((t) => sanitizeInput(String(t), 30)).join(", ") || "None specified"
    : "None specified";
  const safeExistingContent = sanitizeInput(existingContent, 8000);
  const safeCustomPrompt = sanitizeInput(customPrompt, 1500);

  if (
    action !== "generate" &&
    (!safeExistingContent || safeExistingContent.trim().length < 10)
  ) {
    return res.status(400).json({ error: "Existing content required for this action!" });
  }

  // --- Per-document concurrency lock (same strategy as streamAIContent) ---
  const lockKey = documentId
    ? `ai:lock:${req.user.id}:${documentId}`
    : `ai:lock:${req.user.id}`;
  let lockAcquired = false;

  if (redisClient) {
    try {
      const acquired = await redisClient.set(lockKey, "1", { EX: 120, NX: true });
      if (!acquired) {
        return res.status(409).json({
          error: "A generation is already in progress. Please wait.",
        });
      }
      lockAcquired = true;
    } catch {
      // Redis temporarily unavailable — allow the request without a lock
    }
  }

  try {
    let prompt = "";

    switch (action) {
      case "generate":
        prompt = `You are an expert AI writing assistant.

Generate polished, high-quality markdown content.

<user_input>
<document_title>${safeDocumentTitle}</document_title>
<user_request>${safeDocumentDescription}</user_request>
<writing_style>${safeStyle}</writing_style>
<tone>${safeTone}</tone>
<target_audience>${safeAudience || "General audience"}</target_audience>
<document_format>${safeFormat || "Freeform"}</document_format>
<desired_length>${safeLength || "Medium"}</desired_length>
<extra_instructions>${safeExtraInstructions || "None"}</extra_instructions>
</user_input>

IMPORTANT:
1. Write in a ${safeStyle.toLowerCase()} tone
2. Match the requested audience
3. Respect the requested format
4. Respect the requested length
5. Follow extra instructions carefully
6. Use markdown formatting
7. Produce polished ready-to-edit content

Generate the content now.`;
        break;

      case "continue":
        prompt = `You are an expert AI writing assistant.

Continue the existing document naturally.

<existing_content>
${safeExistingContent}
</existing_content>

IMPORTANT:
1. Continue seamlessly
2. Do NOT repeat content
3. Match existing tone/style/format
4. Return ONLY continuation text`;
        break;

      case "rewrite":
        prompt = `Rewrite this content while preserving meaning.

CONTENT:
${safeExistingContent}`;
        break;

      case "expand":
        prompt = `Expand this content with more detail, examples, and clarity.

CONTENT:
${safeExistingContent}`;
        break;

      case "shorten":
        prompt = `Condense this content while preserving key meaning.

CONTENT:
${safeExistingContent}`;
        break;

      case "grammar":
        prompt = `Fix grammar, punctuation, and readability.

Do not change meaning.

CONTENT:
${safeExistingContent}`;
        break;

      case "simplify":
        prompt = `Rewrite in simpler language.

Make it easier to understand.

CONTENT:
${safeExistingContent}`;
        break;

      case "custom":
        prompt = `You are an expert AI writing assistant.

Follow the user's instructions carefully.

<user_instruction>
${safeCustomPrompt}
</user_instruction>

<existing_content>
${safeExistingContent}
</existing_content>

IMPORTANT:
1. Follow the user's instructions
2. Preserve markdown formatting where appropriate
3. Return only the transformed content`;
        break;
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      })
    );

    const content = response.text;

    if (!content || content.trim().length < 100) {
      return res.status(500).json({
        error: "Generated content is too short or invalid!",
      });
    }

    return res.status(200).json({
      message: "Document content generated successfully!",
      content: content.trim(),
    });
  } catch (error) {
    console.error("Error generating document content:", error);

    const status = error?.status || error?.code;

    if (status === 429) {
      return res.status(429).json({
        error: "AI quota exceeded. Please try again later.",
      });
    }

    if (status === 503) {
      return res.status(503).json({
        error: "AI service is busy right now. Please try again in a moment.",
      });
    }

    return res.status(500).json({
      error: "Failed to generate AI content.",
    });
  } finally {
    if (lockAcquired) {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
}

module.exports = {
  generateDocumentContent,
  streamAIContent,
};
