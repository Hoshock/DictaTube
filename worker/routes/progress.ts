import type { Progress } from "@shared/types"

const CLEARED_VALUE = 1
const NOT_CLEARED_VALUE = 0
const INVALID_BODY_STATUS = 400

interface ProgressRow {
  chunk_index: number
  cleared: number
  attempts: number
  updated_at: string
}

interface ProgressRequestBody {
  videoId: string
  chunkIndex: number
  cleared: boolean
}

const isProgressRequestBody = (value: unknown): value is ProgressRequestBody => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return (
    typeof body.videoId === "string" &&
    typeof body.chunkIndex === "number" &&
    typeof body.cleared === "boolean"
  )
}

const toClearedValue = (cleared: boolean): number => {
  if (cleared) {
    return CLEARED_VALUE
  }
  return NOT_CLEARED_VALUE
}

const toProgress = (videoId: string, row: ProgressRow): Progress => ({
  videoId,
  chunkIndex: row.chunk_index,
  cleared: row.cleared === CLEARED_VALUE,
  attempts: row.attempts,
  updatedAt: row.updated_at,
})

export const getVideoProgress = async (db: D1Database, videoId: string): Promise<Response> => {
  const { results } = await db
    .prepare(
      "SELECT chunk_index, cleared, attempts, updated_at FROM progress WHERE video_id = ?1 ORDER BY chunk_index ASC",
    )
    .bind(videoId)
    .all<ProgressRow>()

  return Response.json(results.map((row) => toProgress(videoId, row)))
}

export const saveProgress = async (db: D1Database, request: Request): Promise<Response> => {
  const body: unknown = await request.json()
  if (!isProgressRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db
    .prepare(
      `INSERT INTO progress (video_id, chunk_index, cleared, attempts, updated_at)
       VALUES (?1, ?2, ?3, 1, datetime('now'))
       ON CONFLICT (video_id, chunk_index)
       DO UPDATE SET
         cleared = ?3,
         attempts = attempts + 1,
         updated_at = datetime('now')`,
    )
    .bind(body.videoId, body.chunkIndex, toClearedValue(body.cleared))
    .run()

  return Response.json({ ok: true })
}
