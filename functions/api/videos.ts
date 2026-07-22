import type { Video } from "@shared/types"

import type { Env } from "../types"

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  duration_ms: number
  created_at: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    "SELECT id, youtube_id, title, duration_ms, created_at FROM videos ORDER BY created_at DESC",
  ).all<VideoRow>()

  const videos: Video[] = results.map((row) => ({
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  }))

  return Response.json(videos)
}
