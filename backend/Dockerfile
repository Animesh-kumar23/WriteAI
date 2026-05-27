# Backend image — used by docker-compose for local development.
# (For production, use the root Dockerfile instead.)

FROM node:20-alpine

WORKDIR /app

RUN corepack enable

# Copy manifests first → Docker caches this layer and skips
# pnpm install on rebuilds when only source files changed.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# docker-compose overrides this CMD with `node --watch` for hot reload.
CMD ["node", "./src/server.js"]
