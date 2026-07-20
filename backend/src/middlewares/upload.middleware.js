const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Path relative to where server.js runs (backend/src)
// This will create backend/uploads
const uploadsDirPath = path.join(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDirPath)) {
  fs.mkdirSync(uploadsDirPath, { recursive: true });
}

const storageEngine = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadsDirPath);
  },
  filename(req, file, callback) {
    // generate unique filename: fieldname-timestamp-randomstring.ext
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

function checkFileType(file, callback) {
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
  const extensionMatched = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetypeMatched = allowedFileTypes.test(file.mimetype);

  if (extensionMatched && mimetypeMatched) {
    callback(null, true);
  } else {
    callback(
      new Error("Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed!")
    );
  }
}

// Extension and mimetype above are both attacker-controlled request metadata,
// so checkFileType() alone doesn't prove the upload is actually an image.
// This inspects the real bytes on disk against known file signatures.
const IMAGE_MAGIC_BYTES = [
  [0xff, 0xd8, 0xff], // JPEG
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0x47, 0x49, 0x46, 0x38], // GIF87a / GIF89a
];

function isWebp(header) {
  return (
    header.length >= 12 &&
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP"
  );
}

function hasImageSignature(header) {
  if (isWebp(header)) return true;
  return IMAGE_MAGIC_BYTES.some(
    (signature) =>
      header.length >= signature.length &&
      signature.every((byte, i) => header[i] === byte)
  );
}

function verifyImageSignature(req, res, next) {
  if (!req.file) return next();

  const header = Buffer.alloc(12);
  const fd = fs.openSync(req.file.path, "r");
  fs.readSync(fd, header, 0, 12, 0);
  fs.closeSync(fd);

  if (!hasImageSignature(header)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Uploaded file is not a valid image." });
  }

  next();
}

const uploadDocumentCoverImage = multer({
  storage: storageEngine,
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter(req, file, callback) {
    checkFileType(file, callback);
  },
}).single("coverImage");

const uploadAvatarImage = multer({
  storage: storageEngine,
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter(req, file, callback) {
    checkFileType(file, callback);
  },
}).single("avatar");

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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter(req, file, callback) {
    checkDocumentFileType(file, callback);
  },
}).single("importFile");

module.exports = {
  uploadDocumentCoverImage,
  uploadAvatarImage,
  uploadDocumentImport,
  verifyImageSignature,
};
