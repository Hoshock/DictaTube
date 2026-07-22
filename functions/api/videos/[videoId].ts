import type { Video } from "@shared/types"

import type { Env } from "../../types"

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  duration_ms: number
  created_at: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const videoId = context.params.videoId
  if (typeof videoId !== "string") {
    return Response.json({ error: "invalid video id" }, { status: 400 })
  }

  const row = await context.env.DB.prepare(
    "SELECT id, youtube_id, title, duration_ms, created_at FROM videos WHERE id = ?1",
  )
    .bind(videoId)
    .first<VideoRow>()

  if (!row) {
    return Response.json({ error: "video not found" }, { status: 404 })
  }

  const video: Video = {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  }

  return Response.json(video)
}
