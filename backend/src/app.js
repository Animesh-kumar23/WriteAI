const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const ENV = require("./configs/env");
const authRouter = require("./routes/auth.route");
const profileRouter = require("./routes/profile.route");
const documentsRouter = require("./routes/documents.route");
const aiRouter = require("./routes/ai.route");
const exportsRouter = require("./routes/exports.route");
const { globalLimiter } = require("./middlewares/rateLimit.middleware");

const app = express();

// AWS terminates HTTPS at its load balancer, so Express should trust that proxy.
app.set("trust proxy", 1);

// Over plain HTTP (COOKIE_SECURE=false) Helmet's defaults break the page:
// the CSP's `upgrade-insecure-requests` forces every asset to HTTPS (which
// isn't there → assets time out → white page) and HSTS pins the browser to
// HTTPS. Keep full protection when behind TLS; relax just those over HTTP.
app.use(
  ENV.COOKIE_SECURE
    ? helmet()
    : helmet({ contentSecurityPolicy: false, hsts: false })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Used by Docker and AWS to check that the web process is running.
app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

const allowedOrigins = ENV.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "")
    .split(",")[0]
    .trim();
  const sameOrigin = `${req.protocol}://${host}`;

  return cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === sameOrigin ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })(req, res, next);
});
app.use(globalLimiter);

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/exports", exportsRouter);

app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// The production Docker image contains the frontend build. Serving it here
// keeps deployment beginner-friendly: one container, one port, one URL.
if (ENV.NODE_ENV === "production") {
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");

  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    const isFrontendRoute =
      req.method === "GET" &&
      req.accepts("html") &&
      !req.path.startsWith("/api/") &&
      !req.path.startsWith("/uploads/");

    if (!isFrontendRoute) return next();
    return res.sendFile(path.join(frontendDist, "index.html"));
  });
}

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
