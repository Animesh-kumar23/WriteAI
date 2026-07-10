const Document = require("../models/document");
const DocumentChunk = require("../models/DocumentChunk");
const path = require("path");
const fs = require("fs");

const {
  createChunksForDocument,
  recomputeDocumentWordCount,
} = require("../utils/documentChunks");

async function getDocuments(req, res) {
  try {
    const documents = await Document.find({
      userId: req.user.id,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      message: "Documents retrieved successfully!",
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Error getting documents:", error);

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function getDocumentById(req, res) {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const chunkCount = await DocumentChunk.countDocuments({
      documentId,
    });

    return res.status(200).json({
      message: "Document retrieved successfully!",
      document: {
        ...document.toObject(),
        chunkCount,
      },
    });
  } catch (error) {
    console.error("Error getting document:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid document ID format!",
      });
    }

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function createDocument(req, res) {
  try {
    const { title, subtitle = "", content = "" } = req.body;

    if (!title) {
      return res.status(400).json({
        error: "Title is required!",
      });
    }

    const document = await Document.create({
      userId: req.user.id,
      title,
      subtitle,
    });

    await createChunksForDocument(document._id, content);

    const chunks = await DocumentChunk.find({
      documentId: document._id,
    })
      .sort({ order: 1 })
      .lean();

    return res.status(201).json({
      message: "Document created successfully!",
      document: {
        ...document.toObject(),
        chunks,
      },
    });
  } catch (error) {
    console.error("Error creating document:", error);

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function updateDocument(req, res) {
  try {
    const { documentId } = req.params;
    const { title, subtitle } = req.body;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (title !== undefined) {
      document.title = title;
    }

    if (subtitle !== undefined) {
      document.subtitle = subtitle;
    }

    await document.save();


    return res.status(200).json({
      message: "Document updated successfully!",
      document: document.toObject(),
    });
  } catch (error) {
    console.error("Error updating document:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid document ID format!",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
      });
    }

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function getDocumentChunks(req, res) {
  try {
    const { documentId } = req.params;
    const { all } = req.query;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (all === "true") {
      const chunks = await DocumentChunk.find({
        documentId,
      })
        .sort({ order: 1 })
        .lean();

      return res.status(200).json({
        chunks,
        total: chunks.length,
        hasMore: false,
      });
    }

    const start = Math.max(parseInt(req.query.start) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit) || 4, 50);

    const chunks = await DocumentChunk.find({
      documentId,
      order: {
        $gte: start,
        $lt: start + limit,
      },
    })
      .sort({ order: 1 })
      .lean();

    const total = await DocumentChunk.countDocuments({
      documentId,
    });

    return res.status(200).json({
      chunks,
      total,
      hasMore: start + limit < total,
    });
  } catch (error) {
    console.error("Error getting chunks:", error);

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function updateDocumentChunk(req, res) {
  try {
    const { documentId, order } = req.params;
    const { content } = req.body;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const chunk = await DocumentChunk.findOneAndUpdate(
      {
        documentId,
        order: Number(order),
      },
      {
        content,
      },
      {
        new: true,
        upsert: false,
      },
    );
    if (!chunk) {
      return res.status(404).json({
        error: "Chunk not found!",
      });
    }

    await recomputeDocumentWordCount(documentId);

    return res.status(200).json({
      chunk,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to update chunk",
    });
  }
}

async function updateDocumentCover(req, res) {
  try {
    const { documentId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error: "No image file provided!",
      });
    }

    const document = await Document.findById(documentId);

    if (!document) {
      fs.unlinkSync(req.file.path);

      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      fs.unlinkSync(req.file.path);

      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (document.coverImage) {
      const oldImagePath = path.join(__dirname, "../../", document.coverImage);

      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    document.coverImage = `/uploads/${req.file.filename}`;
    await document.save();

    return res.status(200).json({
      message: "Cover updated successfully!",
      document,
    });
  } catch (error) {
    console.error("Error updating cover:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function deleteDocument(req, res) {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (document.coverImage) {
      const imagePath = path.join(__dirname, "../../", document.coverImage);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await DocumentChunk.deleteMany({
      documentId,
    });

    await document.deleteOne();

    return res.status(200).json({
      message: "Document deleted successfully!",
      deletedDocumentId: documentId,
    });
  } catch (error) {
    console.error("Error deleting document:", error);

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

async function createDocumentChunk(req, res) {
  try {
    const { documentId } = req.params;
    const { content = "", order } = req.body;

    if (order === undefined || order < 0) {
      return res.status(400).json({
        error: "Valid chunk order is required!",
      });
    }

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const existingChunk = await DocumentChunk.findOne({
      documentId,
      order,
    });

    if (existingChunk) {
      return res.status(409).json({
        error: "Chunk already exists!",
      });
    }

    const chunk = await DocumentChunk.create({
      documentId,
      order,
      content,
    });

    await recomputeDocumentWordCount(documentId);

    return res.status(201).json({
      chunk,
    });
  } catch (error) {
    console.error("Error creating chunk:", error);

    return res.status(500).json({
      error: "Failed to create chunk",
    });
  }
}

async function batchUpdateChunks(req, res) {
  try {
    const { documentId } = req.params;
    // clientVersions: optional map of { [order]: version } for conflict detection
    const { chunks, clientVersions } = req.body;

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: "chunks must be a non-empty array." });
    }

    if (chunks.length > 500) {
      return res.status(400).json({ error: "Cannot batch-save more than 500 chunks at once." });
    }

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: "Document not found!" });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const hasVersions = clientVersions && typeof clientVersions === "object";

    // Separate versioned chunks (conflict-checked) from unversioned (upsert freely)
    const versionedChunks = [];
    const unversionedChunks = [];

    chunks.forEach(({ order, content }) => {
      const clientVersion = hasVersions ? clientVersions[order] : undefined;
      if (clientVersion !== undefined) {
        versionedChunks.push({ order: Number(order), content, clientVersion });
      } else {
        unversionedChunks.push({ order: Number(order), content });
      }
    });

    let updated = 0;

    // Run versioned updates in a separate bulkWrite so matchedCount is unambiguous
    if (versionedChunks.length > 0) {
      const versionedOps = versionedChunks.map(({ order, content, clientVersion }) => ({
        updateOne: {
          filter: { documentId, order, version: clientVersion },
          update: { $set: { content }, $inc: { version: 1 } },
          upsert: false,
        },
      }));

      const versionedResult = await DocumentChunk.bulkWrite(versionedOps);
      updated += versionedResult.modifiedCount;

      if (versionedResult.matchedCount < versionedChunks.length) {
        // At least one versioned chunk didn't match — fetch current server state for conflicted orders
        const savedOrders = new Set();
        // We can't tell which specific ops matched from bulkWrite alone, so fetch all and compare
        const serverChunks = await DocumentChunk.find(
          { documentId, order: { $in: versionedChunks.map((c) => c.order) } },
          { order: 1, content: 1, version: 1, updatedAt: 1 }
        ).lean();

        // After the bulkWrite, matched chunks have version === clientVersion + 1
        serverChunks.forEach((sc) => {
          const sent = versionedChunks.find((c) => c.order === sc.order);
          if (
            sent &&
            sc.version === sent.clientVersion + 1 &&
            sc.content === sent.content
          ) {
            savedOrders.add(sc.order);
          }
        });

        const conflictedChunks = serverChunks.filter(
          (sc) => !savedOrders.has(sc.order)
        );

        return res.status(409).json({
          conflict: true,
          conflictedOrders: conflictedChunks.map((c) => c.order),
          serverChunks: conflictedChunks,
        });
      }
    }

    // Non-versioned updates use upsert to create-or-overwrite freely
    if (unversionedChunks.length > 0) {
      const unversionedOps = unversionedChunks.map(({ order, content }) => ({
        updateOne: {
          filter: { documentId, order },
          update: { $set: { content } },
          upsert: true,
        },
      }));

      const unversionedResult = await DocumentChunk.bulkWrite(unversionedOps);
      updated += unversionedResult.modifiedCount + unversionedResult.upsertedCount;
    }

    if (updated > 0) {
      await recomputeDocumentWordCount(documentId);
    }

    return res.status(200).json({ updated });
  } catch (error) {
    console.error("Error batch-updating chunks:", error);
    return res.status(500).json({ error: "Failed to batch-save chunks." });
  }
}

async function deleteAllDocumentChunks(req, res) {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        error: "Document not found!",
      });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    await DocumentChunk.deleteMany({ documentId });

    return res.status(200).json({
      message: "Chunks deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting chunks:", error);

    return res.status(500).json({
      error: "Internal Server Error!",
    });
  }
}

module.exports = {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  getDocumentChunks,
  updateDocumentChunk,
  batchUpdateChunks,
  createDocumentChunk,
  updateDocumentCover,
  deleteDocument,
  deleteAllDocumentChunks,
};
