import type { Playlist, Video } from "@shared/types"

import { nextTopPosition } from "../lib/ordering"

interface PlaylistRow {
  id: string
  name: string
  position: number
  created_at: string
}

interface PlaylistVideoRow {
  video_id: string
  playlist_id: string
}

interface VideoRow {
  id: string
  youtube_id: string
  title: string
  duration_ms: number
  position: number
  created_at: string
}

const INVALID_BODY_STATUS = 400

interface CreatePlaylistRequestBody {
  id: string
  name: string
}

const isCreatePlaylistRequestBody = (value: unknown): value is CreatePlaylistRequestBody => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return typeof body.id === "string" && typeof body.name === "string"
}

const toPlaylist = (row: PlaylistRow): Playlist => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  position: row.position,
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

export const listPlaylists = async (db: D1Database): Promise<Response> => {
  const { results } = await db
    .prepare("SELECT id, name, position, created_at FROM playlists ORDER BY position ASC")
    .all<PlaylistRow>()

  return Response.json(results.map((row) => toPlaylist(row)))
}

export const createPlaylist = async (db: D1Database, request: Request): Promise<Response> => {
  const body: unknown = await request.json()
  if (!isCreatePlaylistRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db
    .prepare("INSERT INTO playlists (id, name, position) VALUES (?1, ?2, ?3)")
    .bind(body.id, body.name, nextTopPosition())
    .run()

  return Response.json({ ok: true })
}

export const deletePlaylist = async (db: D1Database, playlistId: string): Promise<Response> => {
  await db.prepare("DELETE FROM playlists WHERE id = ?1").bind(playlistId).run()
  return Response.json({ ok: true })
}

interface ReorderPlaylistsRequestBody {
  playlistIds: string[]
}

const isReorderPlaylistsRequestBody = (value: unknown): value is ReorderPlaylistsRequestBody => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return Array.isArray(body.playlistIds) && body.playlistIds.every((id) => typeof id === "string")
}

export const reorderPlaylists = async (db: D1Database, request: Request): Promise<Response> => {
  const body: unknown = await request.json()
  if (!isReorderPlaylistsRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db.batch(
    body.playlistIds.map((playlistId, index) =>
      db.prepare("UPDATE playlists SET position = ?1 WHERE id = ?2").bind(index, playlistId),
    ),
  )

  return Response.json({ ok: true })
}

export const getPlaylistVideos = async (db: D1Database, playlistId: string): Promise<Response> => {
  const [{ results }, { results: allPlaylistVideoResults }] = await Promise.all([
    db
      .prepare(
        `SELECT v.id, v.youtube_id, v.title, v.duration_ms, v.position, v.created_at
         FROM videos v
         JOIN playlist_videos pv ON pv.video_id = v.id
         WHERE pv.playlist_id = ?1
         ORDER BY pv.position ASC`,
      )
      .bind(playlistId)
      .all<VideoRow>(),
    db.prepare("SELECT playlist_id, video_id FROM playlist_videos").all<PlaylistVideoRow>(),
  ])

  const playlistIdsByVideoId = groupPlaylistIdsByVideoId(allPlaylistVideoResults)
  const videos: Video[] = results.map((row) => ({
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    position: row.position,
    playlistIds: playlistIdsByVideoId.get(row.id) ?? [],
  }))

  return Response.json(videos)
}

export const addVideoToPlaylist = async (
  db: D1Database,
  playlistId: string,
  request: Request,
): Promise<Response> => {
  const body: unknown = await request.json()
  const videoId = (body as { videoId?: unknown } | null)?.videoId
  if (typeof videoId !== "string") {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db
    .prepare(
      `INSERT INTO playlist_videos (playlist_id, video_id, position) VALUES (?1, ?2, ?3)
       ON CONFLICT DO NOTHING`,
    )
    .bind(playlistId, videoId, nextTopPosition())
    .run()

  return Response.json({ ok: true })
}

interface ReorderPlaylistVideosRequestBody {
  videoIds: string[]
}

const isReorderPlaylistVideosRequestBody = (
  value: unknown,
): value is ReorderPlaylistVideosRequestBody => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const body = value as Record<string, unknown>
  return Array.isArray(body.videoIds) && body.videoIds.every((id) => typeof id === "string")
}

export const reorderPlaylistVideos = async (
  db: D1Database,
  playlistId: string,
  request: Request,
): Promise<Response> => {
  const body: unknown = await request.json()
  if (!isReorderPlaylistVideosRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db.batch(
    body.videoIds.map((videoId, index) =>
      db
        .prepare(
          "UPDATE playlist_videos SET position = ?1 WHERE playlist_id = ?2 AND video_id = ?3",
        )
        .bind(index, playlistId, videoId),
    ),
  )

  return Response.json({ ok: true })
}
