const multer = require("multer");
const path = require("path");

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
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    checkDocumentFileType(file, callback);
  },
}).single("importFile");

module.exports = { uploadDocumentImport };
