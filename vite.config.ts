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
      // これら2組は--fixが互いに元へ戻し合う自己矛盾ペア。
      // Restriction側 (no-rest-spread-properties / no-undefined) を残す。
      "prefer-object-spread": "off",
      "no-typeof-undefined": "off",
      // No-null/no-undefinedが両方有効だとリテラルで「未設定」を表す手段がなくなる一方、
      // 通常のカウンタ変数は初期化が必須。両立できないためoffにする。
      "init-declarations": "off",
    },
    env: {
      browser: true,
      builtin: true,
      node: true,
    },
    // YouTube IFrame Player APIのグローバル名前空間 (app/youtube-iframe-api.ts) と
    // Vue SFCのコンパイラマクロ (app/views/player-view.vue)。
    globals: {
      YT: "readonly",
      defineProps: "readonly",
    },
  },
  fmt: {
    semi: false,
  },
})
