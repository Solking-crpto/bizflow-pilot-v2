import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests-e2e/**", "node_modules/**"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
