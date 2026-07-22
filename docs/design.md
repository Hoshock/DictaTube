# DictaTube 設計メモ

YouTube の自動字幕を使ってリスニング・ディクテーション学習をするための個人用 Web アプリ。動画を数秒〜十数秒のチャンクに区切って繰り返し再生し、書き取りと進捗管理を行う。利用者は Hoshock のみ。スマホからの利用が主。

2026-07-22 時点の技術調査と設計の記録。個別の意思決定の経緯は [ADR](./adr/index.md) を参照。

## アーキテクチャ

```
[スマホ / PC ブラウザ]
    │ GitHub アカウントでログイン (Cloudflare Access が Hoshock のみ許可)
    ▼
Cloudflare Pages (dictatube.pages.dev)
    ├─ SPA: Vue 3 + TypeScript + Vite Plus + Tailwind 4
    └─ Pages Functions (/api/*)
         ├─ D1: videos / chunks / progress
         └─ YouTube 字幕取得 (経路はスパイクで確定)
    ▲
    │ push で自動デプロイ
[GitHub: Hoshock/DictaTube (ソースコードのみ)]
```

| レイヤ     | 採用                                  | 補足                                                                           |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 配信 + API | Cloudflare Pages + Functions          | GitHub push で自動デプロイ                                                     |
| 認証       | Cloudflare Access + GitHub IdP        | Hoshock のみ許可。[ADR-001](./adr/001-cloudflare-pages-access-hosting-auth.md) |
| データ     | Cloudflare D1                         | GitHub 認証情報を持たない。[ADR-002](./adr/002-d1-data-store.md)               |
| 動画再生   | YouTube IFrame Player API             | チャンクループは seekTo + ポーリング                                           |
| フロント   | Vue 3 + TypeScript + Vite Plus + pnpm | NCPD-Template-Child の site-sample と同じ流儀                                  |

すべて無料枠に収まる。

## 字幕取得経路の実測結果 (2026-07-22)

YouTube のボット対策の影響が経路ごとに大きく異なるため、実測して判断した。

| 経路                          | 結果                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ローカル (住宅 IP) の yt-dlp  | 成功。en / en-orig の自動字幕を json3 で取得 (eIho2S0ZahI で確認)                                               |
| GitHub Actions ランナー       | 不可。「Sign in to confirm you're not a bot」で拒否。deno + bgutil PO Token プロバイダを足しても LOGIN_REQUIRED |
| ブラウザから直接 fetch        | 不可。YouTube 側に CORS ヘッダがない                                                                            |
| WASM (Pyodide 上の yt-dlp 等) | 不可。ネットワークは結局ブラウザの fetch を通るため CORS を回避できない                                         |
| Cloudflare Workers            | 未検証。次のスパイクで判定                                                                                      |

調査で確定したその他の制約:

- 公式 Data API v3 では自動生成字幕を取得できない (captions.download は自分がアップロードした動画のみ)
- 静的サイト単体では GitHub OAuth を完結できない。トークン交換に client secret が必須で、エンドポイントが CORS 非対応
- PO Token 要件 (caption URL に exp=xpe が付く動画) が一部に出ており、住宅 IP でも影響する場合がある

## 字幕データの扱い

json3 形式は単語ごとのタイムスタンプ (tOffsetMs) を持つ。自動字幕はローリング表示のため行イベントが前後と重複しており、aAppend イベントを除外して単語ストリームに復元してから使う。

チャンク分割は「約 8 秒たまり、かつ 0.35 秒以上の発話の切れ目」で区切る方式を検証済み。eIho2S0ZahI (9 分 54 秒、単語 1,645) で 61 チャンク、平均 9.4 秒になった。単語タイムスタンプを D1 に保持しておけば、区切り方は後から変えられる。

## import の設計

Workers から YouTube に届くかのスパイク結果で確定する。

- 通る場合: /api/import が字幕取得、チャンク化、D1 保存まで行う。スマホだけで完結
- 通らない場合: トランスクリプト貼り付け import (ブラウザ内でパース) を主経路にし、Mac 常駐のキューデーモンを補助に置く

チャンク化ロジックは chunker.ts の 1 実装に集約し、SPA と Functions で共有する。

## 実装ステップ

| #   | 内容                                                                                       |
| --- | ------------------------------------------------------------------------------------------ |
| 0   | スパイク: Workers から YouTube 字幕取得の実測                                              |
| 1   | scaffold: Vite Plus + Vue + Pages + D1 スキーマ + Access 設定 (モバイルファースト、PWA)    |
| 2   | Home 一覧 + /api/videos                                                                    |
| 3   | Player + チャンクループ (playsinline、ユーザー操作起点の再生開始)                          |
| 4   | import (スパイク結果の経路 + 貼り付けフォールバック)                                       |
| 5   | ディクテーション (単語 diff 判定) + 進捗保存                                               |
| 6   | フェーズ 2: シャドーイング採点 (transformers.js + whisper 系 WASM、完全クライアントサイド) |

## セットアップ状況

- wrangler 4.112.0 導入済み。brew の cloudflare-wrangler を使う (npx 経由は社内証明書の検証で失敗する)
- wrangler login は未実施
- Zero Trust の GitHub IdP 接続と Pages プロジェクト作成も未実施。scaffold の段階で設定する
- ステップ1(scaffold)・ステップ2(Home一覧 + /api/videos)・ステップ3(Player + チャンクループ、YouTube IFrame Player API)はコードレベルで完了。progress保存APIも先行実装済み。ただしCloudflareへのログインができない環境で書いたため、実際のD1・Access・YouTube再生に対する動作確認はまだ (`pnpm test` / `pnpm type-check` / `pnpm build` はローカルで通過、UIの見た目とルーティングはGitHub Pagesのdevプレビューで確認済み)
- ステップ0(字幕取得スパイク)とステップ4(import)は未着手。Cloudflareにログインできる環境での作業が必要

## 開発時の見た目確認 (GitHub Pages)

Cloudflareにログインできないサンドボックス環境からでも見た目を確認できるよう、GitHub ActionsでGitHub Pagesにdevプレビューをデプロイする ([ADR-003](./adr/003-github-pages-dev-preview.md))。バックエンドを持たないため `VITE_DEMO_MODE=true` ビルドでは `/api/*` を呼ばずモックデータ (`app/demo-data.ts`) を表示する。本番の判断基準にはならない (UIの見た目確認専用)。手動設定は不要 — `actions/configure-pages` が初回実行時にPagesサイト自体を自動作成する。
