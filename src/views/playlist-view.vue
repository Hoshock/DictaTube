<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { VueDraggable } from "vue-draggable-plus"

import type { Playlist, Video } from "@shared/types"

import SwipeableItem from "../components/swipeable-item.vue"
import VideoListItem from "../components/video-list-item.vue"
import {
  deleteDemoVideo,
  demoPlaylists,
  getDemoPlaylistVideos,
  getDemoUnfiledVideos,
  reorderDemoPlaylistVideos,
  reorderDemoUnfiledVideos,
} from "../demo-data"

const UNFILED_PLAYLIST_ID = "unfiled"
const UNFILED_PLAYLIST_NAME = "未分類"
const DRAG_LONG_PRESS_DELAY_MS = 300
// スワイプ削除(SwipeableItemの activation threshold)より小さい値にして、
// 横に動かした場合はSortable側が必ず先に諦めるようにする。
const DRAG_TOUCH_START_THRESHOLD_PX = 5

const { playlistId } = defineProps<{
  playlistId: string
}>()

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true"
const isUnfiled = computed(() => playlistId === UNFILED_PLAYLIST_ID)

const playlistName = ref("")
const videos = ref<Video[]>([])
const isLoading = ref(true)
const errorMessage = ref("")
const searchQuery = ref("")
const isReordering = ref(false)

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const fetchPlaylists = async (): Promise<Playlist[]> => {
  const response = await fetch("/api/playlists")
  if (!response.ok) {
    throw new Error(`failed to load playlists: ${response.status}`)
  }
  return (await response.json()) as Playlist[]
}

const fetchPlaylistVideos = async (id: string): Promise<Video[]> => {
  const response = await fetch(`/api/playlists/${id}/videos`)
  if (!response.ok) {
    throw new Error(`failed to load playlist videos: ${response.status}`)
  }
  return (await response.json()) as Video[]
}

const fetchAllVideos = async (): Promise<Video[]> => {
  const response = await fetch("/api/videos")
  if (!response.ok) {
    throw new Error(`failed to load videos: ${response.status}`)
  }
  return (await response.json()) as Video[]
}

const loadDemoData = (): void => {
  if (isUnfiled.value) {
    playlistName.value = UNFILED_PLAYLIST_NAME
    videos.value = getDemoUnfiledVideos()
    return
  }
  playlistName.value = demoPlaylists.find((playlist) => playlist.id === playlistId)?.name ?? ""
  videos.value = getDemoPlaylistVideos(playlistId)
}

const loadRemoteData = async (): Promise<void> => {
  if (isUnfiled.value) {
    playlistName.value = UNFILED_PLAYLIST_NAME
    const allVideos = await fetchAllVideos()
    videos.value = allVideos
      .filter((video) => video.playlistIds.length === 0)
      .sort((a, b) => a.position - b.position)
    return
  }
  const [playlists, playlistVideos] = await Promise.all([
    fetchPlaylists(),
    fetchPlaylistVideos(playlistId),
  ])
  playlistName.value = playlists.find((playlist) => playlist.id === playlistId)?.name ?? ""
  videos.value = playlistVideos
}

onMounted(async () => {
  if (isDemoMode) {
    loadDemoData()
    isLoading.value = false
    return
  }
  try {
    await loadRemoteData()
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  } finally {
    isLoading.value = false
  }
})

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => normalizedQuery.value.length > 0)
const filteredVideos = computed(() =>
  videos.value.filter((video) => video.title.toLowerCase().includes(normalizedQuery.value)),
)

const reorderRemote = async (videoIds: string[]): Promise<void> => {
  const path = isUnfiled.value
    ? "/api/videos/reorder"
    : `/api/playlists/${playlistId}/videos/reorder`
  await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoIds }),
  })
}

const onReorderEnd = async (): Promise<void> => {
  isReordering.value = false
  const orderedIds = videos.value.map((video) => video.id)
  if (isDemoMode) {
    if (isUnfiled.value) {
      reorderDemoUnfiledVideos(orderedIds)
    } else {
      reorderDemoPlaylistVideos(playlistId, orderedIds)
    }
    return
  }
  try {
    await reorderRemote(orderedIds)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
}

const deleteVideoRemote = async (videoId: string): Promise<void> => {
  const response = await fetch(`/api/videos/${videoId}`, { method: "DELETE" })
  if (!response.ok) {
    throw new Error("動画の削除に失敗しました")
  }
}

const onDeleteVideo = async (videoId: string): Promise<void> => {
  videos.value = videos.value.filter((video) => video.id !== videoId)
  if (isDemoMode) {
    deleteDemoVideo(videoId)
    return
  }
  try {
    await deleteVideoRemote(videoId)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
}
</script>

<template>
  <main class="safe-area-inset mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
    <header
      class="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface/90 px-4"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="shrink-0 rounded-full p-1.5 text-ink-muted transition active:bg-surface-overlay"
        aria-label="ホームに戻る"
      >
        ‹
      </RouterLink>
      <p class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ playlistName }}</p>
    </header>

    <div class="flex-1 overflow-y-auto px-4 pb-4 pt-3">
      <div v-if="isLoading" class="flex flex-col gap-3">
        <div class="h-20 animate-pulse rounded-2xl bg-surface-raised" />
        <div class="h-20 animate-pulse rounded-2xl bg-surface-raised" />
      </div>

      <p
        v-else-if="errorMessage"
        class="mt-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm text-danger-500"
      >
        {{ errorMessage }}
      </p>

      <p v-else-if="videos.length === 0" class="mt-10 text-center text-sm text-ink-muted">
        まだ動画がありません。
      </p>

      <VueDraggable
        v-else-if="!isSearching"
        v-model="videos"
        :delay="DRAG_LONG_PRESS_DELAY_MS"
        :touch-start-threshold="DRAG_TOUCH_START_THRESHOLD_PX"
        :animation="150"
        tag="ul"
        class="flex flex-col gap-3"
        @start="isReordering = true"
        @end="onReorderEnd"
      >
        <li v-for="video in videos" :key="video.id">
          <SwipeableItem :disabled="isReordering" @delete="onDeleteVideo(video.id)">
            <VideoListItem :video="video" />
          </SwipeableItem>
        </li>
      </VueDraggable>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="video in filteredVideos" :key="video.id">
          <SwipeableItem @delete="onDeleteVideo(video.id)">
            <VideoListItem :video="video" />
          </SwipeableItem>
        </li>
      </ul>
    </div>

    <div class="safe-area-bottom shrink-0 border-t border-border-subtle bg-surface/95 px-4 pt-3">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="動画を検索"
        class="w-full rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
      />
    </div>
  </main>
</template>
