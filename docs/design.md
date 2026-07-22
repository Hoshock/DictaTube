# Holo Shadowing 設計メモ

YouTube の自動字幕を使ってリスニング練習をするための個人用 Web アプリ。動画を数秒〜十数秒のチャンクに区切り、字幕表示のON/OFF切り替えとリピート再生で繰り返し聞く。利用者は Hoshock のみ。スマホからの利用が主。ディクテーション(タイピングでの正誤判定)・進捗採点はロードマップから除外し、シンプルなリスニング練習に絞っている。

2026-07-22 時点の技術調査と設計の記録。個別の意思決定の経緯は [ADR](./adr/index.md) を参照。

## アーキテクチャ

```
[スマホ / PC ブラウザ]
    │ GitHub アカウントでログイン (Cloudflare Access が Hoshock のみ許可)
    ▼
Cloudflare Workers (holo-shadowing.workers.dev)
    ├─ 静的配信: Vue 3 + TypeScript + Vite Plus + Tailwind 4 (dist/client)
    └─ Worker (worker/index.ts, /api/*)
         ├─ D1: videos / chunks / progress / playlists / playlist_videos
         └─ YouTube 字幕取得 (経路はスパイクで確定)
    ▲
    │ mainへのpushで自動デプロイ (deploy-production.yml)
[GitHub: Hoshock/DictaTube (ソースコードのみ)]
    develop ブランチへのpushはGitHub Pagesのdevプレビューに向く (別経路、下記参照)
```

| レイヤ     | 採用                                           | 補足                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 配信 + API | Cloudflare Workers (`@cloudflare/vite-plugin`) | mainへのpush で自動デプロイ (`cloudflare/wrangler-action`)。Pages Functionsから変更。[ADR-004](./adr/004-cloudflare-workers-vite-plugin.md) / [ADR-005](./adr/005-develop-main-branch-deploy-split.md) |
| 認証       | Cloudflare Access + GitHub IdP                 | Hoshock のみ許可。[ADR-001](./adr/001-cloudflare-pages-access-hosting-auth.md)                                                                                                                         |
| データ     | Cloudflare D1                                  | GitHub 認証情報を持たない。[ADR-002](./adr/002-d1-data-store.md)                                                                                                                                       |
| 動画再生   | YouTube IFrame Player API                      | チャンクループは seekTo + ポーリング                                                                                                                                                                   |
| フロント   | Vue 3 + TypeScript + Vite Plus + pnpm          | `src/` は素のVite標準 (Childの入れ子`src/app/`とは事情が違う。[ADR-004](./adr/004-cloudflare-workers-vite-plugin.md))                                                                                  |
| 並び替え   | vue-draggable-plus (SortableJSラッパー)        | 唯一のVue以外の実行時依存。スワイプ削除は依存追加せず自前実装 (`src/components/swipeable-item.vue`)                                                                                                    |

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

字幕取得の実処理は Workers から YouTube に届くかのスパイク結果で確定する (`/api/import` は未実装)。

- 通る場合: /api/import が字幕取得、チャンク化、D1 保存まで行う。スマホだけで完結
- 通らない場合: トランスクリプト貼り付け import (ブラウザ内でパース) を主経路にし、Mac 常駐のキューデーモンを補助に置く

チャンク化ロジックは chunker.ts の 1 実装に集約し、SPA と Worker で共有する。

インポート画面のUI (URL入力 → プレイリスト選択) はステップ0の結果を待たずに先行実装済み (`src/views/import-view.vue`)。デモモードでは URL から動画IDだけ取り出したダミー動画で一連の流れを確認できる。本番では `/api/import` 呼び出しが失敗した場合にエラーメッセージを表示するのみで、実際の字幕取得は上記スパイクの完了後に実装する。

## 実装ステップ

| #   | 内容                                                                                       |
| --- | ------------------------------------------------------------------------------------------ |
| 0   | スパイク: Workers から YouTube 字幕取得の実測                                              |
| 1   | scaffold: Vite Plus + Vue + Pages + D1 スキーマ + Access 設定 (モバイルファースト、PWA)    |
| 2   | Home 一覧 + /api/videos                                                                    |
| 3   | Player + チャンクループ (playsinline、ユーザー操作起点の再生開始)                          |
| 4   | import (スパイク結果の経路 + 貼り付けフォールバック)                                       |
| 5   | 字幕ON/OFF切り替え + チャンクリピート再生                                                  |
| 6   | プレイリスト (Home表示、/api/playlists) + インポート画面のUI (URL入力 → プレイリスト選択)  |
| 7   | フェーズ 2: シャドーイング採点 (transformers.js + whisper 系 WASM、完全クライアントサイド) |

ディクテーション(タイピングでの正誤判定)と、それに紐づく進捗保存はロードマップから除外した。理由は本セッションでの利用者フィードバック — 入力させる操作自体が不要、進捗の自動判定基準もなくなるため。字幕表示のON/OFF切り替えとチャンクリピート再生というシンプルなリスニング練習に絞る。

## セットアップ状況

- wrangler 4.112.0 導入済み。brew の cloudflare-wrangler を使う (npx 経由は社内証明書の検証で失敗する)
- wrangler login は未実施
- Zero Trust の GitHub IdP 接続とWorkerのカスタムドメイン設定も未実施。scaffold の段階で設定する
- ステップ1(scaffold)・ステップ2(Home一覧 + /api/videos)・ステップ3(Player + チャンクループ、YouTube IFrame Player API)・ステップ5(字幕ON/OFF切り替え + チャンクリピート再生)はコードレベルで完了。ただしCloudflareへのログインができない環境で書いたため、実際のD1・Access・YouTube再生に対する動作確認はまだ (`pnpm test` / `pnpm type-check` / `pnpm build` はローカルで通過、UIの見た目とルーティングはGitHub Pagesのdevプレビューで確認済み)
- あわせてUIを全面刷新(ダークテーマ、モバイルファースト、safe-area対応、ホーム画面のサムネイルカード)。サムネイル画像読み込み失敗時はプレースホルダーにフォールバックする
- 進捗保存API(`POST /api/progress`)自体はscaffold段階から先行実装されているが、フロントからは呼んでいない(ディクテーション採点をロードマップから外したため、クリア判定基準がなくなった)。D1の`progress`テーブル・APIはそのまま残置 — 将来フェーズ2で別の完了基準を設ける可能性があるための保留であり、今すぐ削除するものではない
- ステップ0(字幕取得スパイク)と、import本体(`/api/import`での字幕取得・チャンク化・D1保存)は未着手。Cloudflareにログインできる環境での作業が必要
- ステップ6(プレイリスト表示 + インポート画面UI)はフロントエンドのみ実装済み。Home画面は各プレイリストを1枚のパネル(名前+動画数)として並べ、タップするとそのプレイリストの動画一覧画面(`/playlists/:playlistId`)に遷移する構成に変更(以前の「Homeに全動画をベタ表示」から変更)。「未分類」も同じ見た目の固定パネルとして扱い、削除・並び替えの対象からは外している。右下の丸型+ボタンから遷移するインポート画面はURL入力→(デモでは疑似import)→追加先プレイリスト選択、の流れのまま。D1の`playlists`/`playlist_videos`テーブルと`/api/playlists`一覧・作成・動画紐付けAPIも用意したが、実データでの動作確認はステップ0と同様に未実施
- Home・プレイリスト詳細それぞれの一覧に、プレイリスト/動画それぞれの検索窓・並び替え(長押しドラッグ、`.drag-handle`列を`vue-draggable-plus`で監視)・削除(左スワイプで削除ボタンが出る、`src/components/swipeable-item.vue`)を追加。並び順は`position`列(値が小さいほど上位)で管理し、新規作成分は既存行に触れず先頭に来る(`worker/lib/ordering.ts`)。検索でフィルタ中は並び替えを無効化(絞り込み後の並びと全体のインデックスがずれるため)、削除はそのまま使える。動画の削除は「そのプレイリストから外す」ではなく「ライブラリから完全に削除」(`DELETE /api/videos/:id`、chunks/progress/playlist_videosへカスケード)。
- Player画面の操作系を全面刷新: 左上のチャンク数表示とドット型チャンクナビゲーションを廃止(チャンク数が多い動画で破綻するため)、CCボタンをヘッダーから下部コントロールに移動。下部は2段構成(1段目: prev/next、2段目: CC / 再生・停止トグル / repeat)。CC・再生停止・repeatの3トグルは配色ルールを完全に統一(ON=ブランドカラーの縁取り+薄い背景+文字色、OFF=枠なし+ミュートグレー、共通のクラス三項演算子1つのみ)——以前はCCがブランド色、repeatが警告色、再生停止が塗りつぶし反転と別々の配色になっていたのを揃えた。字幕ボックスはCC ON/OFFで枠のサイズ・スタイルを一切変えず、中の文字だけを表示/非表示にする(余計な代替文言も出さない)。画面全体は`h-dvh overflow-hidden`+flexで組み、字幕ボックスだけが`flex-1 min-h-0`で残り高さを埋めるため、通常の長さのチャンクなら画面スクロールなしで全要素が収まる(ボックス自身の`overflow-y-auto`は異常に長いチャンク用の保険)。再生ボタンは押すたびにチャンク先頭へ巻き戻さず、単純な再生・一時停止のトグルに変更(チャンク切り替え時のみ先頭にシークする)
- ディレクトリ構成をNuxt4化する案を検討したが、Childが実はNuxtを使っていない(AWS SAM/CloudFormationの静的サイトサンプル)ことが判明し撤回。代わりに素のVite標準の`src/`命名と、Cloudflareの現行推奨である`@cloudflare/vite-plugin`+Workersへの移行を実施 ([ADR-004](./adr/004-cloudflare-workers-vite-plugin.md))
- `develop`ブランチを新設し、`main`は本番専用に整理 ([ADR-005](./adr/005-develop-main-branch-deploy-split.md))。`main`へのpushをトリガーに`deploy-production.yml`でCloudflare Workersへ自動デプロイする仕組みも追加したが、**まだ成功しない**: `CLOUDFLARE_API_TOKEN`をリポジトリのSecretsに登録する作業と、`wrangler.jsonc`のD1 `database_id`(現在プレースホルダの`REPLACE_WITH_D1_DATABASE_ID`)を実際のD1インスタンスのIDに置き換える作業が、どちらもオーナー自身のマシンでの`wrangler`ログインを前提とするため未完了

## 開発時の見た目確認 (GitHub Pages)

Cloudflareにログインできないサンドボックス環境からでも見た目を確認できるよう、`develop`ブランチへのpushをトリガーにGitHub ActionsでGitHub Pagesにdevプレビューをデプロイする ([ADR-003](./adr/003-github-pages-dev-preview.md)、ブランチトリガーは[ADR-005](./adr/005-develop-main-branch-deploy-split.md))。バックエンドを持たないため `VITE_DEMO_MODE=true` ビルドでは `/api/*` を呼ばずモックデータ (`src/demo-data.ts`) を表示する。本番の判断基準にはならない (UIの見た目確認専用)。**手動設定が必要** — `gh-pages.yml`に`pages: write`があっても、`actions/configure-pages`はデフォルトのGITHUB_TOKENの権限だけではPagesサイトを新規作成できない (実際の失敗ログで確認: `enablement: false`のままだと未有効化リポジトリでは`Get Pages site`が404、`enablement: true`を試すと`Create Pages site failed: Resource not accessible by integration`)。リポジトリのオーナーがSettings → Pages → Build and deployment → SourceでGitHub Actionsを選ぶ一度だけの操作が必要。
