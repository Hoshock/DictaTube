<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

import type { Chunk, Video } from "@shared/types"

import { demoChunksByVideoId, demoVideos } from "../demo-data"
import { loadYouTubeIframeApi } from "../youtube-iframe-api"

const { videoId } = defineProps<{
  videoId: string
}>()

const FIRST_CHUNK_INDEX = 0
const CHUNK_INDEX_STEP = 1
const MS_PER_SECOND = 1000
const CHUNK_LOOP_POLL_INTERVAL_MS = 200
const YT_FLAG_ENABLED = 1
const YT_FLAG_DISABLED = 0

const video = ref<Video | undefined>()
const chunks = ref<Chunk[]>([])
const isLoading = ref(true)
const errorMessage = ref("")
const currentChunkIndex = ref(FIRST_CHUNK_INDEX)
const isPlayerReady = ref(false)

let player: YT.Player | undefined
let pollIntervalId: number | undefined

const currentChunk = computed<Chunk | undefined>(() => chunks.value[currentChunkIndex.value])
const hasPreviousChunk = computed(() => currentChunkIndex.value > FIRST_CHUNK_INDEX)
const hasNextChunk = computed(
  () => currentChunkIndex.value < chunks.value.length - CHUNK_INDEX_STEP,
)

interface VideoData {
  video: Video
  chunks: Chunk[]
}

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const loadDemoData = (id: string): VideoData => {
  const demoVideo = demoVideos.find((item) => item.id === id)
  if (!demoVideo) {
    throw new Error("動画が見つかりません")
  }
  return { video: demoVideo, chunks: demoChunksByVideoId[id] ?? [] }
}

const fetchRemoteData = async (id: string): Promise<VideoData> => {
  const [videoResponse, chunksResponse] = await Promise.all([
    fetch(`/api/videos/${id}`),
    fetch(`/api/videos/${id}/chunks`),
  ])
  if (!videoResponse.ok || !chunksResponse.ok) {
    throw new Error("動画の読み込みに失敗しました")
  }
  const loadedVideo = (await videoResponse.json()) as Video
  const loadedChunks = (await chunksResponse.json()) as Chunk[]
  return { video: loadedVideo, chunks: loadedChunks }
}

// GitHub Pagesのdevプレビューにはバックエンドがないのでモックを使う。
const resolveVideoData = async (id: string): Promise<VideoData> => {
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    return loadDemoData(id)
  }
  return await fetchRemoteData(id)
}

const loadData = async (id: string): Promise<void> => {
  try {
    const data = await resolveVideoData(id)
    video.value = data.video
    chunks.value = data.chunks
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  } finally {
    isLoading.value = false
  }
}

const setupPlayer = async (youtubeId: string): Promise<void> => {
  const YTApi = await loadYouTubeIframeApi()
  player = new YTApi.Player("youtube-player", {
    videoId: youtubeId,
    playerVars: {
      playsinline: YT_FLAG_ENABLED,
      controls: YT_FLAG_DISABLED,
      rel: YT_FLAG_DISABLED,
    },
    events: {
      onReady: (): void => {
        isPlayerReady.value = true
      },
    },
  })
}

const stopPolling = (): void => {
  if (pollIntervalId) {
    globalThis.clearInterval(pollIntervalId)
  }
}

const startPolling = (): void => {
  stopPolling()
  pollIntervalId = globalThis.setInterval(() => {
    const chunk = currentChunk.value
    if (!player || !chunk) {
      return
    }
    const currentMs = player.getCurrentTime() * MS_PER_SECOND
    if (currentMs >= chunk.endMs) {
      player.pauseVideo()
      stopPolling()
    }
  }, CHUNK_LOOP_POLL_INTERVAL_MS)
}

// チャンクの再生は必ずユーザー操作(タップ)から始める。
// モバイルブラウザは操作起点なしの再生開始を許可しないため (docs/design.md ステップ3)。
const playCurrentChunk = (): void => {
  const chunk = currentChunk.value
  if (!player || !chunk) {
    return
  }
  player.seekTo(chunk.startMs / MS_PER_SECOND, true)
  player.playVideo()
  startPolling()
}

const goToChunk = (index: number): void => {
  if (index < FIRST_CHUNK_INDEX || index >= chunks.value.length) {
    return
  }
  stopPolling()
  if (player) {
    player.pauseVideo()
  }
  currentChunkIndex.value = index
}

onMounted(async () => {
  await loadData(videoId)
  if (video.value) {
    await setupPlayer(video.value.youtubeId)
  }
})

onBeforeUnmount(() => {
  stopPolling()
  if (player) {
    player.destroy()
  }
})
</script>

<template>
  <main class="mx-auto flex max-w-md flex-col gap-4 p-4">
    <p v-if="isLoading" class="text-gray-500">読み込み中...</p>
    <p v-else-if="errorMessage" class="text-red-600">{{ errorMessage }}</p>

    <template v-else>
      <div id="youtube-player" class="aspect-video w-full bg-black" />

      <p v-if="!isPlayerReady" class="text-sm text-gray-500">プレーヤーを準備中...</p>

      <p v-if="currentChunk" class="rounded-lg bg-gray-100 p-3 text-lg">
        {{ currentChunk.text }}
      </p>
      <p v-else class="text-gray-500">この動画にはチャンクがまだありません。</p>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border border-gray-300 py-2 disabled:opacity-40"
          :disabled="!hasPreviousChunk"
          @click="goToChunk(currentChunkIndex - 1)"
        >
          前へ
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg bg-gray-900 py-2 text-white disabled:opacity-40"
          :disabled="!isPlayerReady || !currentChunk"
          @click="playCurrentChunk"
        >
          再生
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border border-gray-300 py-2 disabled:opacity-40"
          :disabled="!hasNextChunk"
          @click="goToChunk(currentChunkIndex + 1)"
        >
          次へ
        </button>
      </div>
    </template>
  </main>
</template>
