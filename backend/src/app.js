const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const ENV = require("./configs/env");
const authRouter = require("./routes/auth.route");
const documentsRouter = require("./routes/documents.route");
const aiRouter = require("./routes/ai.route");
const exportsRouter = require("./routes/exports.route");
const { globalLimiter } = require("./middlewares/rateLimit.middleware");
const { MAX_UPLOAD_SIZE_MB } = require("./middlewares/upload.middleware");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

const allowedOrigins = ENV.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(globalLimiter);

app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/exports", exportsRouter);

app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use((err, _, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: `File size too large! Max ${MAX_UPLOAD_SIZE_MB}MB allowed.` });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

app.use((err, _, res, next) => {
  console.error("Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    error: "Something went wrong!",
    ...(ENV.NODE_ENV === "development" && { details: err.message }),
  });
});

module.exports = app;
