const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
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
} = require("../controllers/documents.controller");
const { searchDocuments } = require("../controllers/search.controller");
const { importDocument } = require("../controllers/import.controller");
const {
  uploadDocumentCoverImage,
  uploadDocumentImport,
  verifyImageSignature,
} = require("../middlewares/upload.middleware");

router.use(authenticate);

router.route("/").get(getDocuments).post(createDocument);

// Must be before /:documentId to prevent "search" being cast as an ObjectId
router.get("/search", searchDocuments);

router
  .route("/:documentId")
  .get(getDocumentById)
  .put(updateDocument)
  .delete(deleteDocument);

router
  .route("/:documentId/chunks")
  .get(getDocumentChunks)
  .post(createDocumentChunk)
  .delete(deleteAllDocumentChunks);

// batch must come before /:order to avoid "batch" being parsed as an order value
router.patch("/:documentId/chunks/batch", batchUpdateChunks);

router.patch(
  "/:documentId/chunks/:order",
  updateDocumentChunk
);

router.put(
  "/:documentId/cover",
  uploadDocumentCoverImage,
  verifyImageSignature,
  updateDocumentCover
);

router.post(
  "/:documentId/import",
  uploadDocumentImport,
  importDocument
);

module.exports = router;