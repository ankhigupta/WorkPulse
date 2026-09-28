import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Loaded here, in Vitest's own config step, so these values land in
// process.env before Vitest evaluates any setup file or test file's
// module graph — that ordering guarantee is what keeps tests from ever
// touching the development database (see tests/setup.ts for the guard).
const testEnv = dotenv.config({ path: path.resolve(import.meta.dirname, ".env.test") }).parsed ?? {};

export default defineConfig({
  test: {
    environment: "node",
    env: testEnv,
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./tests/setup.ts"],
    // Test files share one physical Postgres database (workpulse_test),
    // so they run one at a time rather than in parallel workers — avoids
    // cross-file data races without needing per-test DB transactions.
    fileParallelism: false,
    globals: false,
    // The suite has grown into real bcrypt hashing (cost 12) + real
    // Postgres round-trips across 200+ tests, run serially. Vitest's
    // 5000ms default per-test timeout is occasionally too tight under
    // load even though nothing is actually broken — a single test stalls
    // past it once in a while, always passes cleanly in isolation or a
    // smaller batch. Raised, not removed: a genuinely hung test should
    // still fail loudly.
    testTimeout: 20000,
  },
});
