import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    // O teste do service worker lê public/sw.js a partir da raiz.
    root: process.cwd(),
    environment: "node",
  },
});
