import type { Chunk } from "@shared/types"

import type { Env } from "../../../types"

interface ChunkRow {
  chunk_index: number
  start_ms: number
  end_ms: number
  text: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { videoId } = context.params
  if (typeof videoId !== "string") {
    return Response.json({ error: "invalid video id" }, { status: 400 })
  }

  const { results } = await context.env.DB.prepare(
    "SELECT chunk_index, start_ms, end_ms, text FROM chunks WHERE video_id = ?1 ORDER BY chunk_index ASC",
  )
    .bind(videoId)
    .all<ChunkRow>()

  const chunks: Chunk[] = results.map((row) => ({
    index: row.chunk_index,
    startMs: row.start_ms,
    endMs: row.end_ms,
    text: row.text,
  }))

  return Response.json(chunks)
}
