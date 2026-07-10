# Testing WriteAI

WriteAI uses a deliberately small test stack:

- **Vitest** runs both backend and frontend tests.
- **Supertest** sends requests directly to the Express app without opening a network port.
- **React Testing Library** exercises React hooks through their public behavior.
- **MongoDB and Redis** run as local services for backend integration tests.

## Unit tests and integration tests

A unit test checks one small piece of code in isolation. The `DocumentModel` and AI stream tests are unit tests because they exercise a class or function directly.

An integration test checks several real pieces working together. The backend tests send HTTP requests through Express, authenticate users, read and write MongoDB, use Redis locks and quotas, and enqueue BullMQ jobs.

## Backend tests

The backend suite imports `src/app.js`, so it does not start `app.listen()`, start the export worker, or call the normal startup path. It uses:

- MongoDB database `writeai_test`
- Redis database `15`
- BullMQ queue name and prefix reserved for tests

Safety guards stop the suite if either database is not test-only. Redis cleanup uses `FLUSHDB` only after confirming database 15; it never uses `FLUSHALL` or clears development database 0.

The Gemini key is a dummy test value. AI requests under test are rejected by the real quota or lock logic before the Gemini client is called. The export test uses the real test queue, verifies the queued job data, removes the job, and closes the queue connection without starting a worker.

## Frontend tests

The frontend runs in jsdom, which provides browser APIs without opening a browser. Tests cover chunk ordering and dirty tracking, hook behavior during successful and overlapping saves, streamed AI chunk ordering, API errors, and request cancellation.

## Run the tests

Use the repository's declared pnpm version. Start MongoDB and Redis first:

```bash
docker compose up -d mongo redis
```

If both services are already installed locally, they only need to be listening on ports `27017` and `6379`.

```bash
# Run one suite
pnpm --dir backend test
pnpm --dir frontend test

# Watch while editing
pnpm --dir backend test:watch
pnpm --dir frontend test:watch

# Generate coverage reports (no minimum threshold yet)
pnpm --dir backend test:coverage
pnpm --dir frontend test:coverage

# Run both suites
pnpm test
```

Coverage reports are written to each package's ignored `coverage/` directory.

## GitHub Actions CI

`.github/workflows/ci.yml` runs on every push and pull request. It uses Node 20 and the repository's declared pnpm version, with frozen lockfiles. The job starts isolated MongoDB and Redis service containers, then runs backend tests, frontend tests, frontend lint, and the frontend production build.

CI does not deploy the application. Vercel and Render continue to deploy through their existing Git integrations.

## Add a backend test

Add a `test(...)` case to `backend/tests/api.integration.test.js`:

1. Create only the user, document, and chunks needed by the scenario.
2. Call the Express app with Supertest.
3. Assert the HTTP response and, when relevant, the stored MongoDB or Redis state.
4. Do not call production services or weaken the test-database guards.

## Add a frontend test

Place a `*.test.js` or `*.test.jsx` file next to the code being tested:

1. Import the public function, class, or hook.
2. Arrange the smallest input needed.
3. Perform the action a caller would perform.
4. Assert observable output or state; avoid large snapshots and implementation-detail assertions.
