<script setup lang="ts">
import { onMounted, ref } from "vue"

import type { Video } from "@shared/types"

import { demoVideos } from "../demo-data"

const videos = ref<Video[]>([])
const isLoading = ref(true)
const errorMessage = ref("")
const brokenThumbnailIds = ref(new Set<string>())

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const DURATION_PAD_LENGTH = 2
const SKELETON_ROWS = 3

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const fetchVideos = async (): Promise<Video[]> => {
  const response = await fetch("/api/videos")
  if (!response.ok) {
    throw new Error(`failed to load videos: ${response.status}`)
  }
  return (await response.json()) as Video[]
}

const padTimePart = (value: number): string => String(value).padStart(DURATION_PAD_LENGTH, "0")

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / MS_PER_SECOND)
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR))
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  if (hours > 0) {
    return `${hours}:${padTimePart(minutes)}:${padTimePart(seconds)}`
  }
  return `${minutes}:${padTimePart(seconds)}`
}

const thumbnailUrl = (youtubeId: string): string =>
  `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`

const markThumbnailBroken = (videoId: string): void => {
  brokenThumbnailIds.value = new Set(brokenThumbnailIds.value).add(videoId)
}

onMounted(async () => {
  // GitHub Pagesのdevプレビューにはバックエンドがないのでモックを使う。
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    videos.value = demoVideos
    isLoading.value = false
    return
  }

  try {
    videos.value = await fetchVideos()
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="safe-area-inset mx-auto flex min-h-dvh max-w-md flex-col">
    <header
      class="sticky top-0 z-10 border-b border-border-subtle bg-surface/90 px-5 pb-4 pt-6 backdrop-blur"
    >
      <h1 class="text-2xl font-bold tracking-tight text-ink">DictaTube</h1>
      <p class="mt-1 text-sm text-ink-muted">字幕でディクテーション学習</p>
    </header>

    <div class="flex-1 px-4 pb-8 pt-4">
      <div v-if="isLoading" class="flex flex-col gap-3">
        <div
          v-for="row in SKELETON_ROWS"
          :key="row"
          class="h-24 animate-pulse rounded-2xl bg-surface-raised"
        />
      </div>

      <p
        v-else-if="errorMessage"
        class="mt-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm text-danger-500"
      >
        {{ errorMessage }}
      </p>

      <div
        v-else-if="videos.length === 0"
        class="mt-14 flex flex-col items-center gap-2 text-center text-ink-muted"
      >
        <p class="text-4xl">🎬</p>
        <p class="text-sm">動画がまだありません。</p>
      </div>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="video in videos" :key="video.id">
          <RouterLink
            :to="{ name: 'player', params: { videoId: video.id } }"
            class="group flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-2 transition active:scale-[0.98] active:bg-surface-overlay"
          >
            <div
              class="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-surface-overlay"
            >
              <img
                v-if="!brokenThumbnailIds.has(video.id)"
                :src="thumbnailUrl(video.youtubeId)"
                :alt="video.title"
                loading="lazy"
                class="h-full w-full object-cover"
                @error="markThumbnailBroken(video.id)"
              />
              <span v-else class="flex h-full w-full items-center justify-center text-2xl">🎬</span>
              <span
                class="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white"
              >
                {{ formatDuration(video.durationMs) }}
              </span>
            </div>
            <div class="min-w-0 flex-1 py-1">
              <p class="truncate text-sm font-medium text-ink">{{ video.title }}</p>
            </div>
            <span class="pr-2 text-ink-muted transition group-active:translate-x-0.5">›</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </main>
</template>
