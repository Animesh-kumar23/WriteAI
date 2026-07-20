const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  getDocumentChunks,
  batchUpdateChunks,
  deleteDocument,
  deleteAllDocumentChunks,
} = require("../controllers/documents.controller");
const { searchDocuments } = require("../controllers/search.controller");
const { importDocument } = require("../controllers/import.controller");
const { uploadDocumentImport } = require("../middlewares/upload.middleware");

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
  .delete(deleteAllDocumentChunks);

router.patch("/:documentId/chunks/batch", batchUpdateChunks);

router.post(
  "/:documentId/import",
  uploadDocumentImport,
  importDocument
);

module.exports = router;
