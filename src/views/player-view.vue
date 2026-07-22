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
const isSubtitleVisible = ref(true)
const isRepeating = ref(false)
const isPlaying = ref(false)

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
        const chunk = currentChunk.value
        if (player && chunk) {
          player.seekTo(chunk.startMs / MS_PER_SECOND, true)
        }
      },
    },
  })
}

const stopPolling = (): void => {
  if (pollIntervalId) {
    globalThis.clearInterval(pollIntervalId)
  }
}

// リピートONの間はチャンクの終端に着いたら先頭に戻して流し続ける。
// OFFなら通常のシンプルな再生・停止として、終端で一時停止するだけにする。
const startPolling = (): void => {
  stopPolling()
  pollIntervalId = globalThis.setInterval(() => {
    const chunk = currentChunk.value
    if (!player || !chunk) {
      return
    }
    const currentMs = player.getCurrentTime() * MS_PER_SECOND
    if (currentMs < chunk.endMs) {
      return
    }
    if (isRepeating.value) {
      player.seekTo(chunk.startMs / MS_PER_SECOND, true)
      return
    }
    player.pauseVideo()
    stopPolling()
    isPlaying.value = false
  }, CHUNK_LOOP_POLL_INTERVAL_MS)
}

// シンプルな再生・停止トグル。再生時は現在の位置からそのまま再開し、
// チャンク先頭への巻き戻しはgoToChunkでのチャンク切り替え時のみ行う。
const togglePlayPause = (): void => {
  if (!player || !currentChunk.value) {
    return
  }
  if (isPlaying.value) {
    player.pauseVideo()
    stopPolling()
    isPlaying.value = false
    return
  }
  player.playVideo()
  isPlaying.value = true
  startPolling()
}

const toggleRepeat = (): void => {
  isRepeating.value = !isRepeating.value
}

const toggleSubtitle = (): void => {
  isSubtitleVisible.value = !isSubtitleVisible.value
}

// チャンク切り替えは必ずユーザー操作(タップ)から始める。
// モバイルブラウザは操作起点なしの再生開始を許可しないため (docs/design.md ステップ3)。
const goToChunk = (index: number): void => {
  if (index < FIRST_CHUNK_INDEX || index >= chunks.value.length) {
    return
  }
  stopPolling()
  isPlaying.value = false
  isRepeating.value = false
  currentChunkIndex.value = index
  const chunk = chunks.value[index]
  if (player && chunk) {
    player.pauseVideo()
    player.seekTo(chunk.startMs / MS_PER_SECOND, true)
  }
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
  <main class="safe-area-inset mx-auto flex min-h-dvh max-w-md flex-col">
    <p v-if="isLoading" class="p-4 text-ink-muted">読み込み中...</p>
    <p v-else-if="errorMessage" class="p-4 text-danger-500">{{ errorMessage }}</p>

    <template v-else>
      <header
        class="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-surface/90 px-3 py-3 backdrop-blur"
      >
        <RouterLink
          :to="{ name: 'home' }"
          class="shrink-0 rounded-full p-1.5 text-ink-muted transition active:bg-surface-overlay"
          aria-label="動画一覧に戻る"
        >
          ‹
        </RouterLink>
        <p class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ video?.title }}</p>
      </header>

      <div class="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <div id="youtube-player" class="aspect-video w-full overflow-hidden rounded-2xl bg-black" />

        <p v-if="!isPlayerReady" class="mt-2 text-center text-xs text-ink-muted">
          プレーヤーを準備中...
        </p>

        <template v-if="currentChunk">
          <div
            v-if="isSubtitleVisible"
            class="mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-4 text-lg leading-relaxed text-ink"
          >
            {{ currentChunk.text }}
          </div>
          <div
            v-else
            class="mt-4 flex items-center justify-center rounded-2xl border border-dashed border-border-subtle p-4 text-sm text-ink-muted"
          >
            字幕は非表示です(CCで表示)
          </div>
        </template>
        <p v-else class="mt-4 text-ink-muted">この動画にはチャンクがまだありません。</p>
      </div>

      <div
        class="safe-area-bottom sticky bottom-0 flex flex-col gap-2 border-t border-border-subtle bg-surface/95 px-4 pt-3 backdrop-blur"
      >
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border border-border-subtle py-2 text-sm text-ink disabled:opacity-30"
            :disabled="!hasPreviousChunk"
            @click="goToChunk(currentChunkIndex - 1)"
          >
            ‹ prev
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border border-border-subtle py-2 text-sm text-ink disabled:opacity-30"
            :disabled="!hasNextChunk"
            @click="goToChunk(currentChunkIndex + 1)"
          >
            next ›
          </button>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border py-2 text-sm font-semibold transition disabled:opacity-30"
            :class="
              isSubtitleVisible
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-transparent text-ink-muted'
            "
            @click="toggleSubtitle"
          >
            CC
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border border-transparent py-2 text-sm font-semibold transition disabled:opacity-30"
            :class="isPlaying ? 'bg-ink text-surface' : 'bg-brand-500 text-white'"
            :disabled="!isPlayerReady || !currentChunk"
            @click="togglePlayPause"
          >
            {{ isPlaying ? "pause" : "play" }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border py-2 text-sm font-semibold transition disabled:opacity-30"
            :class="
              isRepeating
                ? 'border-warning-500 bg-warning-500/10 text-warning-500'
                : 'border-transparent text-ink-muted'
            "
            @click="toggleRepeat"
          >
            repeat
          </button>
        </div>
      </div>
    </template>
  </main>
</template>
