const mongoose = require("mongoose");



const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },

    subtitle: {
      type: String,
      default: "",
      maxLength: 300,
    },

    coverImage: {
      type: String,
      default: "",
    },

    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
documentSchema.index({ userId: 1 });
documentSchema.index({ title: "text" }); // Enable text search on title

const Document = mongoose.model("Document", documentSchema);
module.exports = Document;
