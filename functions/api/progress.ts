import type { Env } from "../types"

interface ProgressRequestBody {
  videoId: string
  chunkIndex: number
  cleared: boolean
}

function isProgressRequestBody(value: unknown): value is ProgressRequestBody {
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body: unknown = await context.request.json()
  if (!isProgressRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: 400 })
  }

  await context.env.DB.prepare(
    `INSERT INTO progress (video_id, chunk_index, cleared, attempts, updated_at)
     VALUES (?1, ?2, ?3, 1, datetime('now'))
     ON CONFLICT (video_id, chunk_index)
     DO UPDATE SET
       cleared = ?3,
       attempts = attempts + 1,
       updated_at = datetime('now')`,
  )
    .bind(body.videoId, body.chunkIndex, body.cleared ? 1 : 0)
    .run()

  return Response.json({ ok: true })
}
