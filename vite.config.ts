import { URL, fileURLToPath } from "node:url"

import { defineConfig } from "vite-plus"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import vueDevTools from "vite-plugin-vue-devtools"

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages のdevプレビュー用ビルドだけ /DictaTube/ を渡す (CI参照)。
  // Cloudflare Pages (本番) はルート配信なので未設定時は "/"。
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("app", import.meta.url)),
      "@shared": fileURLToPath(new URL("shared", import.meta.url)),
    },
  },
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "vue"],
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    ignorePatterns: ["**/dist/**", "**/dist-ssr/**", "**/coverage/**"],
    categories: {
      correctness: "error",
      suspicious: "warn",
      pedantic: "warn",
      perf: "warn",
      style: "error",
      restriction: "error",
      nursery: "warn",
    },
    rules: {
      "no-async-await": "off",
      "sort-imports": ["error", { allowSeparatedGroups: true }],
      "sort-keys": "allow",
    },
    env: {
      browser: true,
      builtin: true,
    },
  },
  fmt: {
    semi: false,
  },
})
