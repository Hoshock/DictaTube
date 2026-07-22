import { URL, fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["shared/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("shared", import.meta.url)),
    },
  },
})
