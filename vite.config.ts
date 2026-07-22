import { URL, fileURLToPath } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import { defineConfig } from "vite-plus"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import vueDevTools from "vite-plugin-vue-devtools"

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages のdevプレビュー用ビルドだけ /DictaTube/ を渡す (CI参照)。
  // Cloudflare Workers (本番) はルート配信なので未設定時は "/"。
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [vue(), vueDevTools(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
      "@shared": fileURLToPath(new URL("shared", import.meta.url)),
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: false,
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        // vite-plusバンドルの`vite-plus/test`はdefineConfig読み込み時にクラッシュするため、
        // このファイルだけは素のvitest/vitest-configを使う (CLAUDE.md Gotchas参照)。
        files: ["vitest.config.ts", "shared/**/*.test.ts"],
        rules: { "vite-plus/prefer-vite-plus-imports": "off" },
      },
    ],
  },
})
