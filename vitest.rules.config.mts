import { defineConfig } from "vitest/config";

// Suite isolata: non presume che i vecchi test Firestore siano ancora presenti.
export default defineConfig({
  test: {
    include: ["tests/market.firestore.rules.test.ts"],
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 20000,
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
