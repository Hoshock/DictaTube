import { deleteVideo, getVideo, getVideoChunks, listVideos, reorderVideos } from "./routes/videos"
import { saveProgress } from "./routes/progress"
import {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistVideos,
  listPlaylists,
  reorderPlaylists,
  reorderPlaylistVideos,
} from "./routes/playlists"

const VIDEOS_LIST_PATH = "/api/videos"
const VIDEOS_REORDER_PATH = "/api/videos/reorder"
const PROGRESS_PATH = "/api/progress"
const PLAYLISTS_LIST_PATH = "/api/playlists"
const PLAYLISTS_REORDER_PATH = "/api/playlists/reorder"
const VIDEO_ID_PATTERN = /^\/api\/videos\/(?<videoId>[^/]+)$/u
const VIDEO_CHUNKS_PATTERN = /^\/api\/videos\/(?<videoId>[^/]+)\/chunks$/u
const PLAYLIST_ID_PATTERN = /^\/api\/playlists\/(?<playlistId>[^/]+)$/u
const PLAYLIST_VIDEOS_PATTERN = /^\/api\/playlists\/(?<playlistId>[^/]+)\/videos$/u
const PLAYLIST_VIDEOS_REORDER_PATTERN = /^\/api\/playlists\/(?<playlistId>[^/]+)\/videos\/reorder$/u

const GET_METHOD = "GET"
const POST_METHOD = "POST"
const DELETE_METHOD = "DELETE"

const extractGroup = (match: RegExpExecArray | null, groupName: string): string | undefined => {
  if (!match || !match.groups) {
    return
  }
  return match.groups[groupName]
}

const routeVideos = (
  request: Request,
  pathname: string,
  env: Env,
): Promise<Response> | undefined => {
  if (pathname === VIDEOS_LIST_PATH && request.method === GET_METHOD) {
    return listVideos(env.DB)
  }

  if (pathname === VIDEOS_REORDER_PATH && request.method === POST_METHOD) {
    return reorderVideos(env.DB, request)
  }

  const chunksVideoId = extractGroup(VIDEO_CHUNKS_PATTERN.exec(pathname), "videoId")
  if (chunksVideoId && request.method === GET_METHOD) {
    return getVideoChunks(env.DB, chunksVideoId)
  }

  const videoId = extractGroup(VIDEO_ID_PATTERN.exec(pathname), "videoId")
  if (videoId && request.method === GET_METHOD) {
    return getVideo(env.DB, videoId)
  }
  if (videoId && request.method === DELETE_METHOD) {
    return deleteVideo(env.DB, videoId)
  }
}

const routePlaylists = (
  request: Request,
  pathname: string,
  env: Env,
): Promise<Response> | undefined => {
  if (pathname === PLAYLISTS_LIST_PATH && request.method === GET_METHOD) {
    return listPlaylists(env.DB)
  }
  if (pathname === PLAYLISTS_LIST_PATH && request.method === POST_METHOD) {
    return createPlaylist(env.DB, request)
  }
  if (pathname === PLAYLISTS_REORDER_PATH && request.method === POST_METHOD) {
    return reorderPlaylists(env.DB, request)
  }

  const reorderPlaylistId = extractGroup(
    PLAYLIST_VIDEOS_REORDER_PATTERN.exec(pathname),
    "playlistId",
  )
  if (reorderPlaylistId && request.method === POST_METHOD) {
    return reorderPlaylistVideos(env.DB, reorderPlaylistId, request)
  }

  const playlistVideosId = extractGroup(PLAYLIST_VIDEOS_PATTERN.exec(pathname), "playlistId")
  if (playlistVideosId && request.method === GET_METHOD) {
    return getPlaylistVideos(env.DB, playlistVideosId)
  }
  if (playlistVideosId && request.method === POST_METHOD) {
    return addVideoToPlaylist(env.DB, playlistVideosId, request)
  }

  const playlistId = extractGroup(PLAYLIST_ID_PATTERN.exec(pathname), "playlistId")
  if (playlistId && request.method === DELETE_METHOD) {
    return deletePlaylist(env.DB, playlistId)
  }
}

const routeApi = (request: Request, env: Env): Promise<Response> | undefined => {
  const { pathname } = new URL(request.url)

  if (pathname === PROGRESS_PATH && request.method === POST_METHOD) {
    return saveProgress(env.DB, request)
  }

  return routeVideos(request, pathname, env) ?? routePlaylists(request, pathname, env)
}

export default {
  fetch: async (request, env, _ctx): Promise<Response> => {
    const apiResponse = await routeApi(request, env)
    if (apiResponse) {
      return apiResponse
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
