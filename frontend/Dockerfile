# Frontend image — used by docker-compose for local development.
# Runs the Vite dev server (with HMR) inside the container.
# (For production, the root Dockerfile builds a static bundle instead.)

FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173

# --host makes Vite bind to 0.0.0.0 instead of 127.0.0.1,
# which is required for the port to be reachable outside the container.
CMD ["pnpm", "dev", "--", "--host"]
