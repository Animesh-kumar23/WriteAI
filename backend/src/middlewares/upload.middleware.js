const multer = require("multer");
const path = require("path");

const MAX_UPLOAD_SIZE_MB = 10;

function checkDocumentFileType(file, callback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".pdf" && file.mimetype === "application/pdf") {
    callback(null, true);
  } else {
    callback(new Error("Only PDF files are supported for import."));
  }
}

const uploadDocumentImport = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    checkDocumentFileType(file, callback);
  },
}).single("importFile");

module.exports = { uploadDocumentImport, MAX_UPLOAD_SIZE_MB };
