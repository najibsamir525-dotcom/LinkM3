import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "html"],
      // Schema file is 95% declarative pgTable/relations definitions.
      // Coverage thresholds apply to connection.ts and future query code.
      // Integration tests (Testcontainers) will cover schema correctness
      // by actually running migrations against a real database.
      thresholds: {
        statements: 30,
        branches: 30,
        functions: 0,
        lines: 30,
      },
    },
  },
});
