<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useRouter } from "vue-router"

import type { Playlist, Video } from "@shared/types"

import {
  addDemoVideoToPlaylists,
  createDemoPlaylist,
  demoPlaylists,
  runDemoImport,
} from "../demo-data"

type ImportStep = "input" | "importing" | "select-playlist"

const IMPORT_NOT_READY_MESSAGE =
  "インポート機能は準備中です(バックエンドの字幕取得経路が未確定、docs/design.md 参照)"

const router = useRouter()
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true"

const step = ref<ImportStep>("input")
const url = ref("")
const errorMessage = ref("")
const playlists = ref<Playlist[]>([])
const selectedPlaylistIds = ref<string[]>([])
const newPlaylistName = ref("")
const importedVideo = ref<Video | undefined>()

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

onMounted(async () => {
  if (isDemoMode) {
    playlists.value = demoPlaylists
    return
  }
  try {
    playlists.value = await fetchPlaylists()
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
})

const fetchRemoteImport = async (importUrl: string): Promise<Video> => {
  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: importUrl }),
  })
  if (!response.ok) {
    throw new Error(IMPORT_NOT_READY_MESSAGE)
  }
  try {
    return (await response.json()) as Video
  } catch {
    throw new Error(IMPORT_NOT_READY_MESSAGE)
  }
}

const startImport = async (): Promise<void> => {
  errorMessage.value = ""
  step.value = "importing"
  try {
    importedVideo.value = isDemoMode ? runDemoImport(url.value) : await fetchRemoteImport(url.value)
    step.value = "select-playlist"
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
    step.value = "input"
  }
}

const togglePlaylistSelection = (playlistId: string): void => {
  if (selectedPlaylistIds.value.includes(playlistId)) {
    selectedPlaylistIds.value = selectedPlaylistIds.value.filter((id) => id !== playlistId)
    return
  }
  selectedPlaylistIds.value = [...selectedPlaylistIds.value, playlistId]
}

const createRemotePlaylist = async (name: string): Promise<Playlist> => {
  const id = crypto.randomUUID()
  const response = await fetch("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name }),
  })
  if (!response.ok) {
    throw new Error("プレイリストの作成に失敗しました")
  }
  return { id, name, createdAt: new Date().toISOString() }
}

const createAndSelectPlaylist = async (): Promise<void> => {
  const name = newPlaylistName.value.trim()
  if (!name) {
    return
  }
  try {
    const playlist = isDemoMode ? createDemoPlaylist(name) : await createRemotePlaylist(name)
    playlists.value = [...playlists.value, playlist]
    selectedPlaylistIds.value = [...selectedPlaylistIds.value, playlist.id]
    newPlaylistName.value = ""
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
  }
}

const addToSelectedPlaylists = async (video: Video): Promise<void> => {
  await Promise.all(
    selectedPlaylistIds.value.map((playlistId) =>
      fetch(`/api/playlists/${playlistId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      }),
    ),
  )
}

const confirmImport = async (): Promise<void> => {
  const video = importedVideo.value
  if (!video) {
    return
  }
  if (isDemoMode) {
    addDemoVideoToPlaylists(video, selectedPlaylistIds.value)
  } else {
    await addToSelectedPlaylists(video)
  }
  await router.push({ name: "home" })
}
</script>

<template>
  <main class="safe-area-inset mx-auto flex min-h-dvh max-w-md flex-col">
    <header
      class="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-surface/90 px-3 py-3 backdrop-blur"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="shrink-0 rounded-full p-1.5 text-ink-muted transition active:bg-surface-overlay"
        aria-label="ホームに戻る"
      >
        ‹
      </RouterLink>
      <p class="text-sm font-medium text-ink">動画をインポート</p>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <template v-if="step === 'input' || step === 'importing'">
        <label class="block text-sm font-medium text-ink" for="import-url">YouTube URL</label>
        <input
          id="import-url"
          v-model="url"
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          class="mt-2 w-full rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
          :disabled="step === 'importing'"
        />

        <p
          v-if="errorMessage"
          class="mt-3 rounded-xl border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-500"
        >
          {{ errorMessage }}
        </p>

        <button
          type="button"
          class="mt-4 w-full rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white transition active:bg-brand-600 disabled:opacity-50"
          :disabled="step === 'importing' || url.trim().length === 0"
          @click="startImport"
        >
          {{ step === "importing" ? "インポート中..." : "インポート開始" }}
        </button>
      </template>

      <template v-else>
        <div v-if="importedVideo" class="flex items-center gap-2 text-sm text-success-500">
          <span aria-hidden="true">✓</span>
          <span class="truncate">{{ importedVideo.title }} をインポートしました</span>
        </div>

        <p class="mt-3 text-sm text-ink-muted">追加するプレイリストを選択してください。</p>

        <p
          v-if="errorMessage"
          class="mt-3 rounded-xl border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-500"
        >
          {{ errorMessage }}
        </p>

        <ul class="mt-4 flex flex-col gap-2">
          <li v-for="playlist in playlists" :key="playlist.id">
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition"
              :class="
                selectedPlaylistIds.includes(playlist.id)
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-border-subtle text-ink'
              "
              @click="togglePlaylistSelection(playlist.id)"
            >
              <span>{{ playlist.name }}</span>
              <span v-if="selectedPlaylistIds.includes(playlist.id)">✓</span>
            </button>
          </li>
        </ul>

        <div class="mt-4 flex gap-2">
          <input
            v-model="newPlaylistName"
            type="text"
            placeholder="新しいプレイリスト名"
            class="min-w-0 flex-1 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
          />
          <button
            type="button"
            class="shrink-0 rounded-xl border border-border-subtle px-3 py-2 text-sm text-ink disabled:opacity-30"
            :disabled="newPlaylistName.trim().length === 0"
            @click="createAndSelectPlaylist"
          >
            作成
          </button>
        </div>

        <button
          type="button"
          class="mt-6 w-full rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white transition active:bg-brand-600"
          @click="confirmImport"
        >
          追加してホームへ
        </button>
      </template>
    </div>
  </main>
</template>
