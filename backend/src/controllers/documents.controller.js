const Document = require("../models/document");
const DocumentChunk = require("../models/DocumentChunk");
const path = require("path");
const chunkLimits = require("../../../config/chunkLimits.json");
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

    return res.status(200).json({
      message: "Document retrieved successfully!",
      document: document.toObject(),
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

    return res.status(201).json({
      message: "Document created successfully!",
      document: document.toObject(),
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

    const chunks = await DocumentChunk.find({
      documentId,
    })
      .sort({ order: 1 })
      .lean();

    return res.status(200).json({ chunks });
  } catch (error) {
    console.error("Error getting chunks:", error);

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

async function batchUpdateChunks(req, res) {
  try {
    const { documentId } = req.params;
    const { chunks = [], clientVersions, deletedChunks = [] } = req.body;

    if (!Array.isArray(chunks) || !Array.isArray(deletedChunks)) {
      return res.status(400).json({ error: "chunks and deletedChunks must be arrays." });
    }

    if (chunks.length + deletedChunks.length === 0) {
      return res.status(400).json({ error: "At least one chunk update or deletion is required." });
    }

    if (chunks.length + deletedChunks.length > chunkLimits.serverBatchOperations) {
      return res.status(400).json({
        error: `Cannot batch-save more than ${chunkLimits.serverBatchOperations} operations at once.`,
      });
    }

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ error: "Document not found!" });
    }

    if (document.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const normalizedChunks = chunks.map(({ order, content }) => ({
      order: Number(order),
      content: content ?? "",
    }));
    const normalizedDeletions = deletedChunks.map(({ order, version }) => ({
      order: Number(order),
      version,
    }));
    const allOrders = [
      ...normalizedChunks.map((chunk) => chunk.order),
      ...normalizedDeletions.map((chunk) => chunk.order),
    ];

    if (allOrders.some((order) => !Number.isInteger(order) || order < 0)) {
      return res.status(400).json({ error: "Every chunk order must be a non-negative integer." });
    }

    if (new Set(allOrders).size !== allOrders.length) {
      return res.status(400).json({ error: "A chunk order cannot be updated and deleted in the same batch." });
    }

    const hasVersions = clientVersions && typeof clientVersions === "object";
    const versionedChunks = [];
    const unversionedChunks = [];

    normalizedChunks.forEach(({ order, content }) => {
      const clientVersion = hasVersions ? clientVersions[order] : undefined;
      if (clientVersion !== undefined) {
        versionedChunks.push({ order, content, clientVersion });
      } else {
        unversionedChunks.push({ order, content });
      }
    });

    const versionedDeletions = normalizedDeletions.filter(
      ({ version }) => version !== undefined
    );
    const unversionedDeletions = normalizedDeletions.filter(
      ({ version }) => version === undefined
    );
    const savedChunks = [];
    const deletedOrders = [];
    let didMutate = false;

    const versionedOps = [
      ...versionedChunks.map(({ order, content, clientVersion }) => ({
        updateOne: {
          filter: { documentId, order, version: clientVersion },
          update: { $set: { content }, $inc: { version: 1 } },
          upsert: false,
        },
      })),
      ...versionedDeletions.map(({ order, version }) => ({
        deleteOne: { filter: { documentId, order, version } },
      })),
    ];

    if (versionedOps.length > 0) {
      await DocumentChunk.bulkWrite(versionedOps);

      // bulkWrite only exposes aggregate counts. Read the affected orders back
      // so the response can identify both successful and conflicting operations.
      const versionedOrders = [
        ...versionedChunks.map((chunk) => chunk.order),
        ...versionedDeletions.map((chunk) => chunk.order),
      ];
      const currentChunks = await DocumentChunk.find(
        { documentId, order: { $in: versionedOrders } },
        { order: 1, content: 1, version: 1, updatedAt: 1 }
      ).lean();
      const currentByOrder = new Map(
        currentChunks.map((chunk) => [chunk.order, chunk])
      );
      const conflictedChunks = [];

      versionedChunks.forEach((sent) => {
        const current = currentByOrder.get(sent.order);
        if (
          current &&
          current.version === sent.clientVersion + 1 &&
          current.content === sent.content
        ) {
          savedChunks.push({ order: current.order, version: current.version });
        } else if (current) {
          conflictedChunks.push(current);
        } else {
          conflictedChunks.push({
            order: sent.order,
            content: "",
            version: null,
            deleted: true,
          });
        }
      });

      versionedDeletions.forEach((sent) => {
        const current = currentByOrder.get(sent.order);
        if (current) {
          conflictedChunks.push(current);
        } else {
          deletedOrders.push(sent.order);
        }
      });

      didMutate = savedChunks.length > 0 || deletedOrders.length > 0;

      if (conflictedChunks.length > 0) {
        if (didMutate) {
          await recomputeDocumentWordCount(documentId);
        }

        return res.status(409).json({
          conflict: true,
          conflictedOrders: conflictedChunks.map((chunk) => chunk.order),
          serverChunks: conflictedChunks,
          savedChunks,
          deletedOrders,
        });
      }
    }

    const unversionedOps = [
      ...unversionedChunks.map(({ order, content }) => ({
        updateOne: {
          filter: { documentId, order },
          update: { $set: { content }, $inc: { version: 1 } },
          upsert: true,
        },
      })),
      ...unversionedDeletions.map(({ order }) => ({
        deleteOne: { filter: { documentId, order } },
      })),
    ];

    if (unversionedOps.length > 0) {
      const unversionedResult = await DocumentChunk.bulkWrite(unversionedOps);
      didMutate = didMutate ||
        unversionedResult.modifiedCount > 0 ||
        unversionedResult.upsertedCount > 0 ||
        unversionedResult.deletedCount > 0;

      if (unversionedChunks.length > 0) {
        const currentChunks = await DocumentChunk.find(
          {
            documentId,
            order: { $in: unversionedChunks.map((chunk) => chunk.order) },
          },
          { order: 1, version: 1 }
        ).lean();
        currentChunks.forEach((chunk) => {
          savedChunks.push({ order: chunk.order, version: chunk.version });
        });
      }

      unversionedDeletions.forEach(({ order }) => deletedOrders.push(order));
    }

    if (didMutate) {
      await recomputeDocumentWordCount(documentId);
    }

    return res.status(200).json({
      updated: savedChunks.length,
      deleted: deletedOrders.length,
      savedChunks,
      deletedOrders,
    });
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
    await Document.findByIdAndUpdate(documentId, { wordCount: 0 });

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
  batchUpdateChunks,
  deleteDocument,
  deleteAllDocumentChunks,
};
