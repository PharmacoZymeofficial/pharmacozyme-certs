import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Rules tests need the Firestore emulator (a JVM) — run separately via
    // `npm run test:rules`, not as part of the regular unit-test suite.
    exclude: ["tests/rules/**", "**/node_modules/**"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});
