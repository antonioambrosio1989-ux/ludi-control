import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["tests/market.registry.api.e2e.test.ts"], environment: "node", testTimeout: 25000, hookTimeout: 45000, pool: "forks", maxWorkers: 1, fileParallelism: false },
});
