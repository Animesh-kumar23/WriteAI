const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const ENV = require("./configs/env");
const { connectToDB } = require("./configs/db");
const { connectToRedis } = require("./configs/redis");
const { createExportWorker } = require("./workers/export.worker");
const authRouter = require("./routes/auth.route");
const profileRouter = require("./routes/profile.route");
const documentsRouter = require("./routes/documents.route");
const aiRouter = require("./routes/ai.route");
const exportsRouter = require("./routes/exports.route");
const { initLimiters, globalLimiter } = require("./middlewares/rateLimit.middleware");

const app = express();

// Security headers
// Helmet can set security headers that are too strict for embedding same-origin-less assets.
// Keep the rest of Helmet defaults, but do not override CORP globally.
app.use(helmet());

// Middlewares
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// CLIENT_URL may be a comma-separated list for multiple Vercel deployments
// e.g. "https://writeai.vercel.app,https://writeai-private.vercel.app"
const allowedOrigins = ENV.CLIENT_URL.split(",").map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server / curl (no Origin header) in dev
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(globalLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/exports", exportsRouter);

// Static folder for user uploads
// Some browsers block static images when COEP/COOP/ CORP headers are too strict (NotSameOrigin).
// Explicitly allow cross-site embedding for uploaded media.
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Frontend is deployed separately on Vercel — backend is API-only.

// ERROR HANDLING - Multer specific errors
app.use((err, _, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size too large! Max 2MB allowed." });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

// GENERAL ERROR HANDLER
app.use((err, _, res, next) => {
  console.error("Unhandled error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Something went wrong!",
    ...(ENV.NODE_ENV === "development" && { details: err.message }),
  });
});

async function startServer() {
  await connectToDB();
  await connectToRedis();
  await initLimiters();
  const exportWorker = createExportWorker();
  if (exportWorker) console.log("Export worker started");
  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
    console.log(`Environment: ${ENV.NODE_ENV}`);
  });
}

(async () => {
  try {
    await startServer();
  } catch (error) {
    console.error("Error starting the server:", error);
  }
})();
