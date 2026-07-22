import type { Chunk, Video } from "@shared/types"

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  duration_ms: number
  position: number
  created_at: string
}

interface PlaylistVideoRow {
  video_id: string
  playlist_id: string
}

interface ChunkRow {
  chunk_index: number
  start_ms: number
  end_ms: number
  text: string
}

const NOT_FOUND_STATUS = 404
const INVALID_BODY_STATUS = 400

const toVideo = (row: VideoRow, playlistIds: string[]): Video => ({
  id: row.id,
  youtubeId: row.youtube_id,
  title: row.title,
  durationMs: row.duration_ms,
  createdAt: row.created_at,
  position: row.position,
  playlistIds,
})

const toChunk = (row: ChunkRow): Chunk => ({
  index: row.chunk_index,
  startMs: row.start_ms,
  endMs: row.end_ms,
  text: row.text,
})

const groupPlaylistIdsByVideoId = (rows: PlaylistVideoRow[]): Map<string, string[]> => {
  const playlistIdsByVideoId = new Map<string, string[]>()
  for (const row of rows) {
    const playlistIds = playlistIdsByVideoId.get(row.video_id) ?? []
    playlistIds.push(row.playlist_id)
    playlistIdsByVideoId.set(row.video_id, playlistIds)
  }
  return playlistIdsByVideoId
}

export const listVideos = async (db: D1Database): Promise<Response> => {
  const [{ results }, { results: playlistVideoResults }] = await Promise.all([
    db
      .prepare(
        "SELECT id, youtube_id, title, duration_ms, position, created_at FROM videos ORDER BY position ASC",
      )
      .all<VideoRow>(),
    db.prepare("SELECT playlist_id, video_id FROM playlist_videos").all<PlaylistVideoRow>(),
  ])

  const playlistIdsByVideoId = groupPlaylistIdsByVideoId(playlistVideoResults)
  return Response.json(results.map((row) => toVideo(row, playlistIdsByVideoId.get(row.id) ?? [])))
}

export const getVideo = async (db: D1Database, videoId: string): Promise<Response> => {
  const [row, { results: playlistVideoResults }] = await Promise.all([
    db
      .prepare(
        "SELECT id, youtube_id, title, duration_ms, position, created_at FROM videos WHERE id = ?1",
      )
      .bind(videoId)
      .first<VideoRow>(),
    db
      .prepare("SELECT playlist_id, video_id FROM playlist_videos WHERE video_id = ?1")
      .bind(videoId)
      .all<PlaylistVideoRow>(),
  ])

  if (!row) {
    return Response.json({ error: "video not found" }, { status: NOT_FOUND_STATUS })
  }

  return Response.json(
    toVideo(
      row,
      playlistVideoResults.map((playlistVideoRow) => playlistVideoRow.playlist_id),
    ),
  )
}

export const getVideoChunks = async (db: D1Database, videoId: string): Promise<Response> => {
  const { results } = await db
    .prepare(
      "SELECT chunk_index, start_ms, end_ms, text FROM chunks WHERE video_id = ?1 ORDER BY chunk_index ASC",
    )
    .bind(videoId)
    .all<ChunkRow>()

  return Response.json(results.map((row) => toChunk(row)))
}

export const deleteVideo = async (db: D1Database, videoId: string): Promise<Response> => {
  await db.prepare("DELETE FROM videos WHERE id = ?1").bind(videoId).run()
  return Response.json({ ok: true })
}

interface ReorderVideosRequestBody {
  videoIds: string[]
}

const isReorderVideosRequestBody = (value: unknown): value is ReorderVideosRequestBody => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return Array.isArray(body.videoIds) && body.videoIds.every((id) => typeof id === "string")
}

// 未分類動画一覧のドラッグ並び替え。渡された順序どおりにposition (0..N-1) を振り直す。
export const reorderVideos = async (db: D1Database, request: Request): Promise<Response> => {
  const body: unknown = await request.json()
  if (!isReorderVideosRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db.batch(
    body.videoIds.map((videoId, index) =>
      db.prepare("UPDATE videos SET position = ?1 WHERE id = ?2").bind(index, videoId),
    ),
  )

  return Response.json({ ok: true })
}
