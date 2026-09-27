# Backend Testing

## Framework

**Vitest** + **Supertest**, not Jest.

Why Vitest: the backend already runs on esbuild-based tooling (`tsx` for dev) and pins bleeding-edge TypeScript 7 (the Go-native "Corsa" compiler). Jest's `ts-jest` transform layer lags behind newest TypeScript releases and adds real config friction. Vitest uses esbuild for its transform — same philosophy as `tsx` — needs minimal config, and doesn't type-check during test runs (that stays a separate, fast `tsc` build/typecheck step, unchanged).

Why Supertest: standard pairing with Express for HTTP-level integration tests. Tests import the real `app` and hit its real routes — no separate server process needed.

## Testing philosophy

Real integration over mocking. No Prisma mocking anywhere — every test that touches the database uses a real, dedicated Postgres test database. `bcrypt`/`jsonwebtoken` are exercised for real too (no crypto mocking). The only things unit-tested with mock `req`/`res`/`next` are `authenticate` and `requireRole` middleware for edge cases (expired JWT, wrong role) that are more precise to pin down directly than to infer indirectly through an HTTP response.

## Test database

A dedicated database, **`workpulse_test`**, on the same local Postgres instance as development. Never the development `workpulse` database.

**One-time setup:**
```bash
createdb workpulse_test
cd backend
DATABASE_URL="postgresql://<your-user>@localhost:5432/workpulse_test" npx prisma migrate deploy
```
`migrate deploy` (not `migrate dev`) — applies the existing migration files as-is, doesn't prompt or generate new ones. Re-run this after adding new migrations to keep the test database's schema current.

Connection details live in **`backend/.env.test`**, which is committed to the repo (not gitignored) — its secret is a disposable test-only value, not a real credential, and committing it means a fresh clone can run tests immediately with no manual setup beyond creating the database itself.

## Never touching the development database

Two independent safeguards:
1. `vitest.config.mts` loads `.env.test` via Vitest's own `test.env` config option — this injects the values into `process.env` before Vitest evaluates *any* setup file or test file's module graph, sidestepping the module-import-hoisting trap a plain `dotenv.config()` call inside a setup file would hit.
2. `tests/setup.ts` throws immediately if `NODE_ENV !== "test"` or `DATABASE_URL` doesn't contain `workpulse_test` — a hard guard that fails loudly regardless of how the test run was invoked.

Tests run with `fileParallelism: false` — all test files share one physical database, so they run one at a time rather than in parallel workers. Avoids cross-file data races without needing per-test DB transactions. Negligible cost at this suite's size.

Every test starts from a clean slate: `tests/setup.ts`'s global `beforeEach` deletes `RefreshToken` → `Employee` → `Store` → `User` → `Organization` (FK-safe order) before every single test, so no test depends on state left behind by another.

## Running tests

```bash
cd backend
npm test                 # run the whole suite once
npm run test:watch       # watch mode
npm run test:coverage    # run once with coverage
npx vitest run path/to/file.test.ts   # a single file
npm test -- path/to/file.test.ts      # same, via npm
```

## What's covered so far

- `src/modules/auth/__tests__/login.test.ts` — login success/failure paths, generic error messages, validation
- `src/modules/auth/__tests__/middleware.test.ts` — `authenticate`/`requireRole`, missing/malformed/invalid/expired tokens
- `src/modules/auth/__tests__/me.test.ts` — current-user endpoint, no `passwordHash` leak, DB-fresh (not stale-JWT) data
- `src/modules/auth/__tests__/refresh.test.ts` — refresh-token rotation, reuse rejection, expiry, revocation, logout idempotency
- `tests/tenantIsolation.test.ts` — auth context carries the correct `organizationId` per user; the schema's composite foreign keys reject a cross-organization `Employee` row at the database level

**Known gap, documented on purpose:** there is no organization-scoped business endpoint yet (Employees/Stores have a schema but no service/route layer), so there's no HTTP request to prove "Org A's token can't list Org B's employees." `tests/tenantIsolation.test.ts` instead tests the actual mechanism tenant isolation depends on today — the database's composite FKs — directly via Prisma. Full HTTP-level cross-tenant access tests should be added once a real org-scoped module exists with its own service-layer query filtering.

Also not chased: 100% coverage. Current run is ~92% statements — the uncovered lines are the `env.ts` fail-fast startup crash path (calls `process.exit`, not meaningfully unit-testable), the error handler's generic-500 branch (no test currently throws a non-`AppError`), and one `requireRole` branch (`req.auth` missing entirely, which in practice never happens after `authenticate` runs first). None of these represent a real behavior gap worth engineering a test around at the expense of a higher number.
