import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/roster.membership.emulator.test.ts"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 30000,
    maxWorkers: 1,
    fileParallelism: false,
  },
});
