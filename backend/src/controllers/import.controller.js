const Document = require("../models/document");
const DocumentChunk = require("../models/DocumentChunk");
const { replaceDocumentChunks } = require("../utils/documentChunks");
const { parseDocxBuffer, parsePdfBuffer } = require("../utils/import.parser");

async function importDocument(req, res) {
  try {
    const { documentId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No file provided." });
    }

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: "Document not found!" });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const isPdf = req.file.mimetype === "application/pdf";
    let parsedText;

    try {
      parsedText = isPdf
        ? await parsePdfBuffer(req.file.buffer)
        : await parseDocxBuffer(req.file.buffer);
    } catch (parseErr) {
      console.error("Import parse error:", parseErr.message);
      return res.status(422).json({
        error: parseErr.message.includes("zip bomb")
          ? "File rejected: suspicious archive structure detected."
          : "Could not parse file. It may be corrupted or unsupported.",
      });
    }

    await replaceDocumentChunks(documentId, parsedText);

    const chunkCount = await DocumentChunk.countDocuments({ documentId });

    return res.status(200).json({
      message: "Document imported successfully.",
      chunkCount,
    });
  } catch (error) {
    console.error("Error importing document:", error);
    return res.status(500).json({ error: "Import failed." });
  }
}

module.exports = { importDocument };
