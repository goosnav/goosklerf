import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Workspace package aliases. The root tests/ directory is not itself a
// workspace package, so it can't depend on @gk/* via package.json. We map the
// names to the source entry points here. Add a new line per package.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@gk/cards": resolve(__dirname, "packages/cards/src/index.ts"),
      "@gk/engine": resolve(__dirname, "packages/engine/src/index.ts"),
      "@gk/ai": resolve(__dirname, "packages/ai/src/index.ts"),
    },
  },
});
