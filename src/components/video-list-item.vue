<script setup lang="ts">
import { ref } from "vue"

import type { Video } from "@shared/types"

const { video } = defineProps<{
  video: Video
}>()

const isThumbnailBroken = ref(false)

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const DURATION_PAD_LENGTH = 2

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
</script>

<template>
  <div class="flex items-center gap-1 bg-surface p-1">
    <span
      class="drag-handle shrink-0 cursor-grab touch-none px-1 py-2 text-lg leading-none text-ink-muted"
      aria-hidden="true"
    >
      ⋮⋮
    </span>
    <RouterLink
      :to="{ name: 'player', params: { videoId: video.id } }"
      class="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-2 transition active:scale-[0.98] active:bg-surface-overlay"
    >
      <div
        class="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-surface-overlay"
      >
        <img
          v-if="!isThumbnailBroken"
          :src="thumbnailUrl(video.youtubeId)"
          :alt="video.title"
          loading="lazy"
          class="h-full w-full object-cover"
          @error="isThumbnailBroken = true"
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
  </div>
</template>
