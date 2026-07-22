<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { VueDraggable } from "vue-draggable-plus"

import type { Playlist, Video } from "@shared/types"

import PlaylistPanel from "../components/playlist-panel.vue"
import SwipeableItem from "../components/swipeable-item.vue"
import { deleteDemoPlaylist, demoPlaylists, demoVideos, reorderDemoPlaylists } from "../demo-data"

const UNFILED_PLAYLIST_ID = "unfiled"
const UNFILED_PLAYLIST_NAME = "未分類"
const DRAG_LONG_PRESS_DELAY_MS = 300

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true"

const playlists = ref<Playlist[]>([])
const videos = ref<Video[]>([])
const isLoading = ref(true)
const errorMessage = ref("")
const searchQuery = ref("")

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

const fetchVideos = async (): Promise<Video[]> => {
  const response = await fetch("/api/videos")
  if (!response.ok) {
    throw new Error(`failed to load videos: ${response.status}`)
  }
  return (await response.json()) as Video[]
}

onMounted(async () => {
  if (isDemoMode) {
    playlists.value = [...demoPlaylists].sort((a, b) => a.position - b.position)
    videos.value = demoVideos
    isLoading.value = false
    return
  }

  try {
    const [playlistsResult, videosResult] = await Promise.all([fetchPlaylists(), fetchVideos()])
    playlists.value = playlistsResult
    videos.value = videosResult
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  } finally {
    isLoading.value = false
  }
})

const videoCountByPlaylistId = computed(() => {
  const counts = new Map<string, number>()
  for (const video of videos.value) {
    for (const playlistId of video.playlistIds) {
      counts.set(playlistId, (counts.get(playlistId) ?? 0) + 1)
    }
  }
  return counts
})

const unfiledVideoCount = computed(
  () => videos.value.filter((video) => video.playlistIds.length === 0).length,
)

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => normalizedQuery.value.length > 0)

const filteredPlaylists = computed(() =>
  playlists.value.filter((playlist) => playlist.name.toLowerCase().includes(normalizedQuery.value)),
)

const isUnfiledVisible = computed(() => UNFILED_PLAYLIST_NAME.includes(normalizedQuery.value))

const reorderPlaylistsRemote = async (playlistIds: string[]): Promise<void> => {
  await fetch("/api/playlists/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistIds }),
  })
}

const onReorderEnd = async (): Promise<void> => {
  const orderedIds = playlists.value.map((playlist) => playlist.id)
  if (isDemoMode) {
    reorderDemoPlaylists(orderedIds)
    return
  }
  try {
    await reorderPlaylistsRemote(orderedIds)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
}

const deletePlaylistRemote = async (playlistId: string): Promise<void> => {
  const response = await fetch(`/api/playlists/${playlistId}`, { method: "DELETE" })
  if (!response.ok) {
    throw new Error("プレイリストの削除に失敗しました")
  }
}

const onDeletePlaylist = async (playlistId: string): Promise<void> => {
  playlists.value = playlists.value.filter((playlist) => playlist.id !== playlistId)
  if (isDemoMode) {
    deleteDemoPlaylist(playlistId)
    return
  }
  try {
    await deletePlaylistRemote(playlistId)
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
}
</script>

<template>
  <main class="safe-area-inset relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden">
    <header
      class="flex shrink-0 flex-col gap-3 border-b border-border-subtle bg-surface/90 px-5 pb-4 pt-6"
    >
      <h1 class="text-2xl font-bold tracking-tight text-ink">Holo Shadowing</h1>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="プレイリストを検索"
        class="w-full rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
      />
    </header>

    <div class="flex-1 overflow-y-auto px-4 pb-24 pt-4">
      <div v-if="isLoading" class="flex flex-col gap-3">
        <div class="h-16 animate-pulse rounded-2xl bg-surface-raised" />
        <div class="h-16 animate-pulse rounded-2xl bg-surface-raised" />
        <div class="h-16 animate-pulse rounded-2xl bg-surface-raised" />
      </div>

      <p
        v-else-if="errorMessage"
        class="mt-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm text-danger-500"
      >
        {{ errorMessage }}
      </p>

      <div v-else class="flex flex-col gap-3">
        <VueDraggable
          v-if="!isSearching"
          v-model="playlists"
          handle=".drag-handle"
          :delay="DRAG_LONG_PRESS_DELAY_MS"
          :delay-on-touch-only="true"
          :animation="150"
          tag="div"
          class="flex flex-col gap-3"
          @end="onReorderEnd"
        >
          <SwipeableItem
            v-for="playlist in playlists"
            :key="playlist.id"
            @delete="onDeletePlaylist(playlist.id)"
          >
            <PlaylistPanel
              :playlist-id="playlist.id"
              :name="playlist.name"
              :video-count="videoCountByPlaylistId.get(playlist.id) ?? 0"
            />
          </SwipeableItem>
        </VueDraggable>

        <template v-else>
          <SwipeableItem
            v-for="playlist in filteredPlaylists"
            :key="playlist.id"
            @delete="onDeletePlaylist(playlist.id)"
          >
            <PlaylistPanel
              :playlist-id="playlist.id"
              :name="playlist.name"
              :video-count="videoCountByPlaylistId.get(playlist.id) ?? 0"
              :show-handle="false"
            />
          </SwipeableItem>
        </template>

        <PlaylistPanel
          v-if="isUnfiledVisible"
          :playlist-id="UNFILED_PLAYLIST_ID"
          :name="UNFILED_PLAYLIST_NAME"
          :video-count="unfiledVideoCount"
          :show-handle="false"
        />

        <p
          v-if="playlists.length === 0 && unfiledVideoCount === 0"
          class="mt-10 text-center text-sm text-ink-muted"
        >
          動画がまだありません。右下の + からインポートできます。
        </p>
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
