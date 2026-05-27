const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");

async function authenticate(req, res, next) {
  // Accept cookie (desktop) or Authorization: Bearer <token> (mobile — cross-site
  // cookies are dropped by iOS Safari ITP and Android Chrome Privacy Sandbox).
  const token =
    req.cookies?.token ?? req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided!" });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.error("Error authenticating user:", error);
    return res.status(401).json({ error: "Invalid or expired token!" });
  }
}

module.exports = { authenticate };
