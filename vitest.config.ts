import { defineConfig } from "vitest/config";

// ═══════════════════════════════════════════════════════════════════════════════
// Vitest configuration for GSTPilot Infinity™
//
// NOTE: Vitest is NOT yet installed in this project (Phase 11 only creates the
// config + the testing-strategy doc). Install when ready:
//
//   bun add -d vitest @vitest/coverage-v8 @testing-library/react \
//       @testing-library/jest-dom jsdom
//
// Then run:
//   bunx vitest run               # one-shot
//   bunx vitest                   # watch mode
//   bunx vitest run --coverage    # with coverage report
//
// See docs/TESTING.md for the full strategy.
// ═══════════════════════════════════════════════════════════════════════════════

export default defineConfig({
  test: {
    // Default environment for unit tests. Components that need the DOM
    // can opt in with a `// @vitest-environment jsdom` comment at the top.
    environment: "node",

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",

      // Measure coverage across the entire src/ tree.
      include: ["src/**/*.{ts,tsx}"],

      // Exclude test files themselves, generated code, type-only files.
      exclude: [
        "node_modules/**",
        ".next/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/__mocks__/**",
        "src/**/types.ts",
        "src/**/types/**",
      ],

      // Global floor — per-directory targets (src/lib ≥80%, src/app/api ≥60%,
      // src/components ≥40%) are documented in docs/TESTING.md §4 and will be
      // enforced by a dedicated CI check once Vitest is installed.
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 60,
      },
    },

    // Discover tests co-located in src/ AND in the top-level tests/ directory.
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],

    // Exclude e2e specs (they're run by Playwright, not Vitest) + build output.
    exclude: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "out/**",
      "tests/e2e/**",
      "functions/**",
    ],

    // Globals so test files don't need `import { describe, it, expect }`.
    // Disabled by default to encourage explicit imports — flip to true if
    // the team prefers the Jest-style ergonomics.
    globals: false,

    // Speed: parallelize across CPU cores.
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
      },
    },
  },
});
