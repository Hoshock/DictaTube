<script setup lang="ts">
import { computed, onMounted, ref } from "vue"

import type { Playlist, Video } from "@shared/types"

import VideoListItem from "../components/video-list-item.vue"
import { demoPlaylists, demoVideos } from "../demo-data"

const videos = ref<Video[]>([])
const playlists = ref<Playlist[]>([])
const isLoading = ref(true)
const errorMessage = ref("")

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

const fetchPlaylists = async (): Promise<Playlist[]> => {
  const response = await fetch("/api/playlists")
  if (!response.ok) {
    throw new Error(`failed to load playlists: ${response.status}`)
  }
  return (await response.json()) as Playlist[]
}

const playlistSections = computed(() =>
  playlists.value.map((playlist) => ({
    playlist,
    videos: videos.value.filter((video) => video.playlistIds.includes(playlist.id)),
  })),
)

const unfiledVideos = computed(() => videos.value.filter((video) => video.playlistIds.length === 0))

onMounted(async () => {
  // GitHub Pagesのdevプレビューにはバックエンドがないのでモックを使う。
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    videos.value = demoVideos
    playlists.value = demoPlaylists
    isLoading.value = false
    return
  }

  try {
    const [videosResult, playlistsResult] = await Promise.all([fetchVideos(), fetchPlaylists()])
    videos.value = videosResult
    playlists.value = playlistsResult
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="safe-area-inset relative mx-auto flex min-h-dvh max-w-md flex-col">
    <header
      class="sticky top-0 z-10 border-b border-border-subtle bg-surface/90 px-5 pb-4 pt-6 backdrop-blur"
    >
      <h1 class="text-2xl font-bold tracking-tight text-ink">Holo Shadowing</h1>
      <p class="mt-1 text-sm text-ink-muted">字幕でリスニング練習</p>
    </header>

    <div class="flex-1 px-4 pb-24 pt-4">
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
        <p class="text-sm">動画がまだありません。右下の + からインポートできます。</p>
      </div>

      <div v-else class="flex flex-col gap-6">
        <section v-for="section in playlistSections" :key="section.playlist.id">
          <h2 class="mb-2 text-sm font-semibold text-ink-muted">{{ section.playlist.name }}</h2>
          <p v-if="section.videos.length === 0" class="text-sm text-ink-muted">
            まだ動画がありません。
          </p>
          <ul v-else class="flex flex-col gap-3">
            <li v-for="video in section.videos" :key="video.id">
              <VideoListItem :video="video" />
            </li>
          </ul>
        </section>

        <section v-if="unfiledVideos.length > 0">
          <h2 class="mb-2 text-sm font-semibold text-ink-muted">未分類</h2>
          <ul class="flex flex-col gap-3">
            <li v-for="video in unfiledVideos" :key="video.id">
              <VideoListItem :video="video" />
            </li>
          </ul>
        </section>
      </div>
    </div>

    <RouterLink
      :to="{ name: 'import' }"
      class="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-3xl font-light text-white shadow-lg shadow-black/30 transition active:scale-95 active:bg-brand-600"
      aria-label="動画をインポート"
    >
      +
    </RouterLink>
  </main>
</template>
