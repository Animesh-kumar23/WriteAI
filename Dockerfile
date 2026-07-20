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

# Use the package-manager version pinned by the project.
RUN corepack enable

# Copy manifest files BEFORE source so Docker reuses this layer
# on rebuilds when only source code changed (not dependencies).
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
COPY config/ /app/config/

RUN pnpm build


# ── Stage 2: production backend ───────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable

COPY backend/package.json backend/pnpm-lock.yaml ./

# --prod skips devDependencies → smaller final image
RUN pnpm install --frozen-lockfile --prod

COPY backend/ ./
COPY config/ /app/config/

# Express in production mode serves frontend/dist as static files.
# app.js resolves the path as __dirname + "/../../frontend/dist"
# (__dirname = /app/backend/src  →  /app/frontend/dist)
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# uploads/ holds user avatars and cover images
RUN mkdir -p /app/backend/uploads && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "./src/server.js"]
