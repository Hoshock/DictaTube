<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

import type { Chunk, Video } from "@shared/types"

import { demoChunksByVideoId, demoVideos } from "../demoData"
import { loadYouTubeIframeApi } from "../youtubeIframeApi"

const props = defineProps<{
  videoId: string
}>()

const video = ref<Video | undefined>()
const chunks = ref<Chunk[]>([])
const isLoading = ref(true)
const errorMessage = ref("")
const currentChunkIndex = ref(0)
const isPlayerReady = ref(false)

let player: YT.Player | undefined
let pollIntervalId: number | undefined

const currentChunk = computed<Chunk | undefined>(() => chunks.value[currentChunkIndex.value])
const hasPreviousChunk = computed(() => currentChunkIndex.value > 0)
const hasNextChunk = computed(() => currentChunkIndex.value < chunks.value.length - 1)

onMounted(async () => {
  await loadData()
  if (video.value) {
    await setupPlayer(video.value.youtubeId)
  }
})

onBeforeUnmount(() => {
  stopPolling()
  player?.destroy()
})

async function loadData() {
  try {
    // GitHub Pagesのdevプレビューにはバックエンドがないのでモックを使う。
    if (import.meta.env.VITE_DEMO_MODE === "true") {
      const demoVideo = demoVideos.find((item) => item.id === props.videoId)
      if (!demoVideo) {
        throw new Error("動画が見つかりません")
      }
      video.value = demoVideo
      chunks.value = demoChunksByVideoId[props.videoId] ?? []
      return
    }

    const [videoResponse, chunksResponse] = await Promise.all([
      fetch(`/api/videos/${props.videoId}`),
      fetch(`/api/videos/${props.videoId}/chunks`),
    ])
    if (!videoResponse.ok || !chunksResponse.ok) {
      throw new Error("動画の読み込みに失敗しました")
    }
    video.value = (await videoResponse.json()) as Video
    chunks.value = (await chunksResponse.json()) as Chunk[]
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

async function setupPlayer(youtubeId: string) {
  const YTApi = await loadYouTubeIframeApi()
  player = new YTApi.Player("youtube-player", {
    videoId: youtubeId,
    playerVars: {
      playsinline: 1,
      controls: 0,
      rel: 0,
    },
    events: {
      onReady: () => {
        isPlayerReady.value = true
      },
    },
  })
}

function startPolling() {
  stopPolling()
  pollIntervalId = window.setInterval(() => {
    const chunk = currentChunk.value
    if (!player || !chunk) {
      return
    }
    const currentMs = player.getCurrentTime() * 1000
    if (currentMs >= chunk.endMs) {
      player.pauseVideo()
      stopPolling()
    }
  }, 200)
}

function stopPolling() {
  if (pollIntervalId !== undefined) {
    window.clearInterval(pollIntervalId)
    pollIntervalId = undefined
  }
}

// チャンクの再生は必ずユーザー操作(タップ)から始める。
// モバイルブラウザは操作起点なしの再生開始を許可しないため (docs/design.md ステップ3)。
function playCurrentChunk() {
  const chunk = currentChunk.value
  if (!player || !chunk) {
    return
  }
  player.seekTo(chunk.startMs / 1000, true)
  player.playVideo()
  startPolling()
}

function goToChunk(index: number) {
  if (index < 0 || index >= chunks.value.length) {
    return
  }
  stopPolling()
  player?.pauseVideo()
  currentChunkIndex.value = index
}
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
