<script setup lang="ts">
import { onMounted, ref } from "vue"

import type { Video } from "@shared/types"

import { demoVideos } from "../demoData"

const videos = ref<Video[]>([])
const isLoading = ref(true)
const errorMessage = ref("")

onMounted(async () => {
  // GitHub Pagesのdevプレビューにはバックエンドがないのでモックを使う。
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    videos.value = demoVideos
    isLoading.value = false
    return
  }

  try {
    const response = await fetch("/api/videos")
    if (!response.ok) {
      throw new Error(`failed to load videos: ${response.status}`)
    }
    videos.value = await response.json()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="mx-auto max-w-md p-4">
    <h1 class="text-xl font-bold">DictaTube</h1>

    <p v-if="isLoading" class="mt-4 text-gray-500">読み込み中...</p>
    <p v-else-if="errorMessage" class="mt-4 text-red-600">{{ errorMessage }}</p>
    <p v-else-if="videos.length === 0" class="mt-4 text-gray-500">
      動画がまだありません。
    </p>

    <ul v-else class="mt-4 flex flex-col gap-2">
      <li v-for="video in videos" :key="video.id">
        <RouterLink
          :to="{ name: 'player', params: { videoId: video.id } }"
          class="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
        >
          {{ video.title }}
        </RouterLink>
      </li>
    </ul>
  </main>
</template>
