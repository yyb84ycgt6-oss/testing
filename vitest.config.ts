import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/*/tests/**/*.test.ts",
      "apps/*/tests/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["packages/*/src/**", "apps/*/src/**"],
    },
  },
  resolve: {
    alias: {
      "@command-center/shared": new URL(
        "./packages/shared/src/index.ts",
        import.meta.url
      ).pathname,
    },
  },
});
