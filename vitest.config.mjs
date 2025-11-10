import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.test.local") });

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
