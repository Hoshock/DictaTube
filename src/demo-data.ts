import type { Chunk, Video } from "@shared/types"

/**
 * GitHub Pages のdevプレビュー用モックデータ。
 * GitHub Pagesは静的配信のみでD1/Functionsを持たないため、
 * VITE_DEMO_MODE=true ビルド時はAPIの代わりにこれを使う (docs/adr/003 参照)。
 */
export const demoVideos: Video[] = [
  {
    id: "demo-1",
    youtubeId: "eIho2S0ZahI",
    title: "(デモ) サンプル動画 1",
    durationMs: 594_000,
    createdAt: "2026-07-22T00:00:00Z",
  },
  {
    id: "demo-2",
    youtubeId: "dQw4w9WgXcQ",
    title: "(デモ) サンプル動画 2",
    durationMs: 212_000,
    createdAt: "2026-07-21T00:00:00Z",
  },
]

export const demoChunksByVideoId: Record<string, Chunk[]> = {
  "demo-1": [
    { index: 0, startMs: 0, endMs: 8200, text: "hello and welcome to this video" },
    { index: 1, startMs: 8200, endMs: 16_900, text: "today we are going to talk about" },
    { index: 2, startMs: 16_900, endMs: 24_100, text: "listening and dictation practice" },
  ],
  "demo-2": [
    { index: 0, startMs: 0, endMs: 7800, text: "never gonna give you up" },
    { index: 1, startMs: 7800, endMs: 15_600, text: "never gonna let you down" },
  ],
}
