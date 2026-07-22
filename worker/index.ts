import { getVideo, getVideoChunks, listVideos } from "./routes/videos"
import { saveProgress } from "./routes/progress"
import { addVideoToPlaylist, createPlaylist, listPlaylists } from "./routes/playlists"

const VIDEOS_LIST_PATH = "/api/videos"
const PROGRESS_PATH = "/api/progress"
const PLAYLISTS_LIST_PATH = "/api/playlists"
const VIDEO_ID_PATTERN = /^\/api\/videos\/(?<videoId>[^/]+)$/u
const VIDEO_CHUNKS_PATTERN = /^\/api\/videos\/(?<videoId>[^/]+)\/chunks$/u
const PLAYLIST_VIDEOS_PATTERN = /^\/api\/playlists\/(?<playlistId>[^/]+)\/videos$/u

const GET_METHOD = "GET"
const POST_METHOD = "POST"

const extractGroup = (match: RegExpExecArray | null, groupName: string): string | undefined => {
  if (!match || !match.groups) {
    return
  }
  return match.groups[groupName]
}

const routeVideoDetail = (
  pathname: string,
  method: string,
  env: Env,
): Promise<Response> | undefined => {
  const chunksVideoId = extractGroup(VIDEO_CHUNKS_PATTERN.exec(pathname), "videoId")
  if (chunksVideoId && method === GET_METHOD) {
    return getVideoChunks(env.DB, chunksVideoId)
  }

  const videoId = extractGroup(VIDEO_ID_PATTERN.exec(pathname), "videoId")
  if (videoId && method === GET_METHOD) {
    return getVideo(env.DB, videoId)
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

  const playlistId = extractGroup(PLAYLIST_VIDEOS_PATTERN.exec(pathname), "playlistId")
  if (playlistId && request.method === POST_METHOD) {
    return addVideoToPlaylist(env.DB, playlistId, request)
  }
}

const routeApi = (request: Request, env: Env): Promise<Response> | undefined => {
  const { pathname } = new URL(request.url)

  if (pathname === VIDEOS_LIST_PATH && request.method === GET_METHOD) {
    return listVideos(env.DB)
  }

  if (pathname === PROGRESS_PATH && request.method === POST_METHOD) {
    return saveProgress(env.DB, request)
  }

  return routeVideoDetail(pathname, request.method, env) ?? routePlaylists(request, pathname, env)
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
