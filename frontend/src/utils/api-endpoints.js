// Set VITE_API_BASE_URL in your .env (dev: http://localhost:3000, prod: https://your-backend.onrender.com)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  DOCUMENTS: {
    GET_ALL: "/api/documents",
    GET_BY_ID: "/api/documents",
    CREATE: "/api/documents",
    UPDATE_CONTENT: "/api/documents",
    UPDATE_COVER: "/api/documents",
    DELETE: "/api/documents",

    GET_CHUNKS: "/api/documents",
    UPDATE_CHUNK: "/api/documents",
    SEARCH: "/api/documents/search",
    IMPORT: "/api/documents",
  },
  AI: {
    GENERATE_CONTENT: "/api/ai/generate-content",
    STREAM: "/api/ai/stream",
  },
  EXPORTS: {
    REQUEST: "/api/exports",          // POST /:documentId/:format
    STATUS: "/api/exports/status",    // GET /:jobId
    DOWNLOAD: "/api/exports/download", // GET /:jobId
  },
};
