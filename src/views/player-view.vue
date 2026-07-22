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

// リピートONの間はチャンクの終端に着いたら先頭に戻して流し続ける。
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

const toggleRepeat = (): void => {
  isRepeating.value = !isRepeating.value
  if (isRepeating.value) {
    playCurrentChunk()
    return
  }
  stopPolling()
  if (player) {
    player.pauseVideo()
  }
}

const toggleSubtitle = (): void => {
  isSubtitleVisible.value = !isSubtitleVisible.value
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
  isRepeating.value = false
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
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink">{{ video?.title }}</p>
          <p class="text-xs text-ink-muted">
            チャンク {{ currentChunkIndex + CHUNK_INDEX_STEP }} / {{ chunks.length }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition"
          :class="
            isSubtitleVisible
              ? 'border-brand-500 bg-brand-500/10 text-brand-400'
              : 'border-border-subtle text-ink-muted'
          "
          @click="toggleSubtitle"
        >
          CC {{ isSubtitleVisible ? "ON" : "OFF" }}
        </button>
      </header>

      <nav
        v-if="chunks.length > 0"
        aria-label="チャンク一覧"
        class="flex gap-1.5 overflow-x-auto px-3 py-2"
      >
        <button
          v-for="chunk in chunks"
          :key="chunk.index"
          type="button"
          class="h-2 w-5 shrink-0 rounded-full transition"
          :class="chunk.index === currentChunkIndex ? 'bg-brand-400' : 'bg-surface-overlay'"
          :aria-label="`チャンク${chunk.index + CHUNK_INDEX_STEP}へ移動`"
          @click="goToChunk(chunk.index)"
        />
      </nav>

      <div class="flex-1 overflow-y-auto px-4 pb-4">
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
            字幕は非表示です(CC ONで表示)
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
            ‹ 前のチャンク
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border border-border-subtle py-2 text-sm text-ink disabled:opacity-30"
            :disabled="!hasNextChunk"
            @click="goToChunk(currentChunkIndex + 1)"
          >
            次のチャンク ›
          </button>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white transition active:bg-brand-600 disabled:opacity-30"
            :disabled="!isPlayerReady || !currentChunk"
            @click="playCurrentChunk"
          >
            ▶ 再生(1回)
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl py-2 text-sm font-semibold transition disabled:opacity-30"
            :class="
              isRepeating ? 'bg-warning-500 text-black' : 'border border-border-subtle text-ink'
            "
            :disabled="!isPlayerReady || !currentChunk"
            @click="toggleRepeat"
          >
            🔁 リピート{{ isRepeating ? "中" : "" }}
          </button>
        </div>
      </div>
    </template>
  </main>
</template>
