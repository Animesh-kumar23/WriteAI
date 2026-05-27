# ─────────────────────────────────────────────────────────────
# PRODUCTION IMAGE — multi-stage build
#
# Stage 1 builds the React frontend (produces /app/frontend/dist).
# Stage 2 installs backend prod-only deps and copies the dist in
# so Express can serve it as static files.
#
# Usage:
#   docker build -t writeai .
#   docker run -p 3000:3000 --env-file backend/.env writeai
# ─────────────────────────────────────────────────────────────


# ── Stage 1: build frontend ───────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# corepack ships with Node 18+ and manages pnpm/yarn without npm install
RUN corepack enable

# Copy manifest files BEFORE source so Docker reuses this layer
# on rebuilds when only source code changed (not dependencies).
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

# Vite bakes VITE_* vars into the JS bundle at build time.
# Pass your production API URL here when building:
#   docker build --build-arg VITE_API_BASE_URL=https://your-app.onrender.com .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm build


# ── Stage 2: production backend ───────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app/backend

RUN corepack enable

COPY backend/package.json backend/pnpm-lock.yaml ./

# --prod skips devDependencies → smaller final image
RUN pnpm install --frozen-lockfile --prod

COPY backend/ ./

# Express in production mode serves frontend/dist as static files.
# server.js resolves the path as __dirname + "/../../frontend/dist"
# (__dirname = /app/backend/src  →  /app/frontend/dist)
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# uploads/ holds user avatars and cover images
RUN mkdir -p /app/backend/uploads

EXPOSE 3000

CMD ["node", "./src/server.js"]
