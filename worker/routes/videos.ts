import type { Chunk, Video } from "@shared/types"

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  duration_ms: number
  created_at: string
}

interface ChunkRow {
  chunk_index: number
  start_ms: number
  end_ms: number
  text: string
}

const NOT_FOUND_STATUS = 404

const toVideo = (row: VideoRow): Video => ({
  id: row.id,
  youtubeId: row.youtube_id,
  title: row.title,
  durationMs: row.duration_ms,
  createdAt: row.created_at,
})

const toChunk = (row: ChunkRow): Chunk => ({
  index: row.chunk_index,
  startMs: row.start_ms,
  endMs: row.end_ms,
  text: row.text,
})

export const listVideos = async (db: D1Database): Promise<Response> => {
  const { results } = await db
    .prepare(
      "SELECT id, youtube_id, title, duration_ms, created_at FROM videos ORDER BY created_at DESC",
    )
    .all<VideoRow>()

  return Response.json(results.map((row) => toVideo(row)))
}

export const getVideo = async (db: D1Database, videoId: string): Promise<Response> => {
  const row = await db
    .prepare("SELECT id, youtube_id, title, duration_ms, created_at FROM videos WHERE id = ?1")
    .bind(videoId)
    .first<VideoRow>()

  if (!row) {
    return Response.json({ error: "video not found" }, { status: NOT_FOUND_STATUS })
  }

  return Response.json(toVideo(row))
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
