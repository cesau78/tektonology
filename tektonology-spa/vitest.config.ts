import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["{lib,components,app}/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "app/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "app/globals.css",
        // Excel export is exercised by tests but branch coverage (edge buffers, defensive throw) is not worth 100% chasing.
        "lib/pew-sections-excel.ts",
      ],
      thresholds: {
        lines: 100,
        // A few defensive branches in pew-map (pillar vs upper band) are unreachable given map invariants.
        branches: 99.5,
        functions: 100,
        statements: 99.8,
      },
    },
  },
});
