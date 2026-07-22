import type { Chunk, Playlist, Video } from "@shared/types"

/**
 * GitHub Pages のdevプレビュー用モックデータ。
 * GitHub Pagesは静的配信のみでD1/Functionsを持たないため、
 * VITE_DEMO_MODE=true ビルド時はAPIの代わりにこれを使う (docs/adr/003 参照)。
 */
export const demoPlaylists: Playlist[] = [
  { id: "demo-playlist-1", name: "(デモ) リスニング入門", createdAt: "2026-07-20T00:00:00Z" },
  { id: "demo-playlist-2", name: "(デモ) お気に入り", createdAt: "2026-07-21T00:00:00Z" },
]

export const demoVideos: Video[] = [
  {
    id: "demo-1",
    youtubeId: "eIho2S0ZahI",
    title: "(デモ) サンプル動画 1",
    durationMs: 594_000,
    createdAt: "2026-07-22T00:00:00Z",
    playlistIds: ["demo-playlist-1"],
  },
  {
    id: "demo-2",
    youtubeId: "dQw4w9WgXcQ",
    title: "(デモ) サンプル動画 2",
    durationMs: 212_000,
    createdAt: "2026-07-21T00:00:00Z",
    playlistIds: ["demo-playlist-1", "demo-playlist-2"],
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

const DEMO_IMPORT_DURATION_MS = 180_000
let demoImportSequence = 0

const extractYoutubeId = (url: string): string | undefined => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1)
    }
    return parsed.searchParams.get("v") ?? undefined
  } catch {
    return undefined
  }
}

/**
 * デモモード用の疑似import。実際の字幕取得バックエンド (docs/design.md 参照、
 * Workers→YouTube経路のスパイクが未確定) の代わりに、URLから動画IDだけ取り出して
 * ダミーのVideoを1件生成する。
 */
export const runDemoImport = (url: string): Video => {
  const youtubeId = extractYoutubeId(url)
  if (!youtubeId) {
    throw new Error("YouTubeの動画URLを入力してください")
  }
  demoImportSequence += 1
  return {
    id: `demo-import-${demoImportSequence}`,
    youtubeId,
    title: `(デモ) インポートした動画 ${demoImportSequence}`,
    durationMs: DEMO_IMPORT_DURATION_MS,
    createdAt: "2026-07-22T00:00:00Z",
    playlistIds: [],
  }
}

export const addDemoVideoToPlaylists = (video: Video, playlistIds: string[]): void => {
  demoVideos.unshift({ ...video, playlistIds })
}

const NEW_PLAYLIST_ID_OFFSET = 1

export const createDemoPlaylist = (name: string): Playlist => {
  const playlist: Playlist = {
    id: `demo-playlist-${demoPlaylists.length + NEW_PLAYLIST_ID_OFFSET}`,
    name,
    createdAt: "2026-07-22T00:00:00Z",
  }
  demoPlaylists.push(playlist)
  return playlist
}
