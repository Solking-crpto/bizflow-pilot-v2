import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./tests/empty-stub.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests-e2e/**", "node_modules/**"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
  },
});
