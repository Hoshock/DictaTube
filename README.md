# DictaTube

YouTube の自動字幕でディクテーション学習をするための個人用Webアプリ。設計の詳細は [docs/design.md](./docs/design.md)、個別の意思決定は [ADR](./docs/adr/index.md) を参照。

## 開発

```bash
pnpm install
pnpm dev          # ローカル開発サーバ
pnpm preview       # ビルド結果をworkerd経由で確認
pnpm test         # shared/chunker.ts のユニットテスト
pnpm type-check    # SPA (src/) + Cloudflare Worker (worker/)
pnpm lint          # oxlint (vite-plus経由)
pnpm format        # oxfmt (vite-plus経由)
pnpm build         # 本番ビルド (dist/client: 静的配信, dist/dictatube: Worker)
```

## デプロイ先

- **本番**: Cloudflare Workers + Access + D1 ([ADR-001](./docs/adr/001-cloudflare-pages-access-hosting-auth.md), [ADR-002](./docs/adr/002-d1-data-store.md), [ADR-004](./docs/adr/004-cloudflare-workers-vite-plugin.md))
- **devプレビュー**: GitHub Pages。バックエンドがないためモックデータで見た目だけ確認する ([ADR-003](./docs/adr/003-github-pages-dev-preview.md))
