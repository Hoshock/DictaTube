<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

import type { Chunk, Progress, Video } from "@shared/types"
import { diffWords, isPerfectMatch, type WordDiffToken } from "@shared/dictation"

import { demoChunksByVideoId, demoProgressByVideoId, demoVideos } from "../demo-data"
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
const progressByChunk = ref<Record<number, Progress>>({})
const isLoading = ref(true)
const errorMessage = ref("")
const currentChunkIndex = ref(FIRST_CHUNK_INDEX)
const isPlayerReady = ref(false)
const typedAnswer = ref("")
const diffTokens = ref<WordDiffToken[]>([])
const showAnswer = ref(false)

let player: YT.Player | undefined
let pollIntervalId: number | undefined

const currentChunk = computed<Chunk | undefined>(() => chunks.value[currentChunkIndex.value])
const hasPreviousChunk = computed(() => currentChunkIndex.value > FIRST_CHUNK_INDEX)
const hasNextChunk = computed(
  () => currentChunkIndex.value < chunks.value.length - CHUNK_INDEX_STEP,
)
const hasChecked = computed(() => diffTokens.value.length > 0)
const isPerfect = computed(() => isPerfectMatch(diffTokens.value))
const clearedCount = computed(
  () => Object.values(progressByChunk.value).filter((entry) => entry.cleared).length,
)

interface VideoData {
  video: Video
  chunks: Chunk[]
  progress: Progress[]
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
  return {
    video: demoVideo,
    chunks: demoChunksByVideoId[id] ?? [],
    progress: demoProgressByVideoId[id] ?? [],
  }
}

const fetchRemoteData = async (id: string): Promise<VideoData> => {
  const [videoResponse, chunksResponse, progressResponse] = await Promise.all([
    fetch(`/api/videos/${id}`),
    fetch(`/api/videos/${id}/chunks`),
    fetch(`/api/videos/${id}/progress`),
  ])
  if (!videoResponse.ok || !chunksResponse.ok || !progressResponse.ok) {
    throw new Error("動画の読み込みに失敗しました")
  }
  const loadedVideo = (await videoResponse.json()) as Video
  const loadedChunks = (await chunksResponse.json()) as Chunk[]
  const loadedProgress = (await progressResponse.json()) as Progress[]
  return { video: loadedVideo, chunks: loadedChunks, progress: loadedProgress }
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
    progressByChunk.value = Object.fromEntries(
      data.progress.map((entry) => [entry.chunkIndex, entry]),
    )
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

const resetAnswerState = (): void => {
  typedAnswer.value = ""
  diffTokens.value = []
  showAnswer.value = false
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
  resetAnswerState()
}

const persistProgress = async (chunkIndex: number, cleared: boolean): Promise<void> => {
  if (import.meta.env.VITE_DEMO_MODE === "true" || !video.value) {
    return
  }
  try {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.value.id, chunkIndex, cleared }),
    })
  } catch {
    // バックエンド未接続でも書き取り自体は続けられるようにし、保存失敗は無視する。
  }
}

const ATTEMPT_STEP = 1
const FIRST_ATTEMPT = 1

const checkAnswer = (): void => {
  const chunk = currentChunk.value
  if (!chunk || !video.value) {
    return
  }
  diffTokens.value = diffWords(chunk.text, typedAnswer.value)
  const cleared = isPerfectMatch(diffTokens.value)
  const previousAttempts =
    progressByChunk.value[chunk.index]?.attempts ?? FIRST_ATTEMPT - ATTEMPT_STEP

  progressByChunk.value = {
    ...progressByChunk.value,
    [chunk.index]: {
      videoId: video.value.id,
      chunkIndex: chunk.index,
      cleared,
      attempts: previousAttempts + ATTEMPT_STEP,
      updatedAt: "",
    },
  }

  void persistProgress(chunk.index, cleared)
}

const retryAnswer = (): void => {
  typedAnswer.value = ""
  diffTokens.value = []
  showAnswer.value = false
}

const toggleShowAnswer = (): void => {
  showAnswer.value = !showAnswer.value
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
            {{ currentChunkIndex + CHUNK_INDEX_STEP }} / {{ chunks.length }} ・ クリア済み
            {{ clearedCount }}
          </p>
        </div>
      </header>

      <div v-if="chunks.length > 0" class="flex gap-1.5 overflow-x-auto px-3 py-2">
        <button
          v-for="chunk in chunks"
          :key="chunk.index"
          type="button"
          class="h-2 w-5 shrink-0 rounded-full transition"
          :class="[
            chunk.index === currentChunkIndex
              ? 'bg-brand-400'
              : progressByChunk[chunk.index]?.cleared
                ? 'bg-success-500/70'
                : 'bg-surface-overlay',
          ]"
          :aria-label="`チャンク${chunk.index + CHUNK_INDEX_STEP}へ移動`"
          @click="goToChunk(chunk.index)"
        />
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-4">
        <div id="youtube-player" class="aspect-video w-full overflow-hidden rounded-2xl bg-black" />

        <p v-if="!isPlayerReady" class="mt-2 text-center text-xs text-ink-muted">
          プレーヤーを準備中...
        </p>

        <template v-if="currentChunk">
          <div class="mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-4">
            <p v-if="showAnswer" class="text-lg leading-relaxed text-ink">
              {{ currentChunk.text }}
            </p>

            <div
              v-else-if="hasChecked"
              class="flex flex-wrap gap-x-1.5 gap-y-1 text-lg leading-relaxed"
            >
              <span
                v-for="(token, index) in diffTokens"
                :key="index"
                :class="{
                  'text-ink': token.status === 'correct',
                  'text-danger-500 line-through decoration-2': token.status === 'missing',
                  'text-warning-500 underline decoration-2 underline-offset-4':
                    token.status === 'extra',
                }"
                >{{ token.word }}</span
              >
            </div>

            <textarea
              v-else
              v-model="typedAnswer"
              rows="3"
              autocapitalize="off"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              placeholder="聞こえた通りに入力..."
              class="w-full resize-none rounded-xl border border-border-subtle bg-surface px-3 py-2 text-base text-ink placeholder-ink-muted focus:border-brand-500 focus:outline-none"
            />

            <p
              v-if="hasChecked && !showAnswer"
              class="mt-3 text-sm font-medium"
              :class="isPerfect ? 'text-success-500' : 'text-warning-500'"
            >
              {{ isPerfect ? "🎉 正解！" : "惜しい、もう一度挑戦してみましょう" }}
            </p>
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
            ‹ 前へ
          </button>
          <button
            type="button"
            class="flex-[1.4] rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white transition active:bg-brand-600 disabled:opacity-30"
            :disabled="!isPlayerReady || !currentChunk"
            @click="playCurrentChunk"
          >
            ▶ 再生
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border border-border-subtle py-2 text-sm text-ink disabled:opacity-30"
            :disabled="!hasNextChunk"
            @click="goToChunk(currentChunkIndex + 1)"
          >
            次へ ›
          </button>
        </div>

        <div v-if="currentChunk" class="flex gap-2">
          <button
            v-if="!hasChecked && !showAnswer"
            type="button"
            class="flex-1 rounded-xl bg-surface-overlay py-2 text-sm font-medium text-ink disabled:opacity-30"
            :disabled="typedAnswer.trim().length === 0"
            @click="checkAnswer"
          >
            答え合わせ
          </button>
          <button
            v-else-if="!showAnswer"
            type="button"
            class="flex-1 rounded-xl bg-surface-overlay py-2 text-sm font-medium text-ink"
            @click="retryAnswer"
          >
            もう一度
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border border-border-subtle py-2 text-sm text-ink-muted"
            @click="toggleShowAnswer"
          >
            {{ showAnswer ? "入力に戻る" : "答えを見る" }}
          </button>
        </div>
      </div>
    </template>
  </main>
</template>
