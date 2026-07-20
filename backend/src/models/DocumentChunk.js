const mongoose = require("mongoose");
const chunkLimits = require("../../../config/chunkLimits.json");

const documentChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },

    order: {
      type: Number,
      required: true,
      min: 0,
    },

    content: {
      type: String,
      default: "",
      maxLength: chunkLimits.databaseMaxChunkCharacters,
    },

    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

documentChunkSchema.index(
  { documentId: 1, order: 1 },
  { unique: true }
);

const DocumentChunk = mongoose.model(
  "DocumentChunk",
  documentChunkSchema
);

module.exports = DocumentChunk;
