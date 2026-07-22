import type { Playlist } from "@shared/types"

interface PlaylistRow {
  id: string
  name: string
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
})

export const listPlaylists = async (db: D1Database): Promise<Response> => {
  const { results } = await db
    .prepare("SELECT id, name, created_at FROM playlists ORDER BY created_at DESC")
    .all<PlaylistRow>()

  return Response.json(results.map((row) => toPlaylist(row)))
}

export const createPlaylist = async (db: D1Database, request: Request): Promise<Response> => {
  const body: unknown = await request.json()
  if (!isCreatePlaylistRequestBody(body)) {
    return Response.json({ error: "invalid request body" }, { status: INVALID_BODY_STATUS })
  }

  await db
    .prepare("INSERT INTO playlists (id, name) VALUES (?1, ?2)")
    .bind(body.id, body.name)
    .run()

  return Response.json({ ok: true })
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
      "INSERT INTO playlist_videos (playlist_id, video_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING",
    )
    .bind(playlistId, videoId)
    .run()

  return Response.json({ ok: true })
}
