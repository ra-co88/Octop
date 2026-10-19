/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Standalone Vitest config — kept separate from ``vite.config.ts`` so:
 * 1. The PWA plugin and SPA build tweaks don't run for unit tests
 *    (they pull heavy deps and slow startup by ~3 s).
 * 2. We can keep ``test.environment`` / ``setupFiles`` in one obvious
 *    place without polluting the prod build config.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    pool: "threads",
    // Bound the worker pool. On an 8-core machine Vitest otherwise opens up to 7
    // threads, and the resulting CPU starvation made timing-sensitive assertions
    // fail in files that pass both alone and in small groups: on pristine
    // `develop` a full run reported "Test Files 4 failed | 249 passed", while
    // the same tree with `--maxWorkers=3` reported 253/253 passing.
    //
    // Measured 2026-10-19, 253 files, same tree:
    //   default pool  -> 2 failed files / 10 failed tests, 597s
    //   --maxWorkers=3 -> 253 passed / 1331 passed,        305s
    //
    // Bounding concurrency is BOTH more reliable and ~2x faster here, because
    // the run is dominated by setup/environment time rather than parallel
    // throughput — the workers were contending, not scaling.
    //
    // This is the real fix rather than a bigger `testTimeout`: raising the
    // budget only hides starvation longer while leaving the race in place (it
    // was tried and still flaked). See .agents/audit/vitest-intermittency.md.
    maxWorkers: 3,
    minWorkers: 1,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/pages/Agent/Memory/**"],
    },
  },
});
