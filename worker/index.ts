import { getVideo, getVideoChunks, listVideos } from "./routes/videos"
import { saveProgress } from "./routes/progress"

const VIDEOS_LIST_PATH = "/api/videos"
const PROGRESS_PATH = "/api/progress"
const VIDEO_ID_PATTERN = /^\/api\/videos\/(?<videoId>[^/]+)$/u
const VIDEO_CHUNKS_PATTERN = /^\/api\/videos\/(?<videoId>[^/]+)\/chunks$/u

const GET_METHOD = "GET"
const POST_METHOD = "POST"

const extractVideoId = (match: RegExpExecArray | null): string | undefined => {
  if (!match || !match.groups) {
    return
  }
  return match.groups.videoId
}

const routeVideoDetail = (
  pathname: string,
  method: string,
  env: Env,
): Promise<Response> | undefined => {
  const chunksVideoId = extractVideoId(VIDEO_CHUNKS_PATTERN.exec(pathname))
  if (chunksVideoId && method === GET_METHOD) {
    return getVideoChunks(env.DB, chunksVideoId)
  }

  const videoId = extractVideoId(VIDEO_ID_PATTERN.exec(pathname))
  if (videoId && method === GET_METHOD) {
    return getVideo(env.DB, videoId)
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

  return routeVideoDetail(pathname, request.method, env)
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
