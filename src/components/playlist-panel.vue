<script setup lang="ts">
defineProps<{
  playlistId: string
  name: string
  videoCount: number
}>()
</script>

<template>
  <RouterLink
    :to="{ name: 'playlist', params: { playlistId } }"
    class="group flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-4 transition active:scale-[0.98] active:bg-surface-overlay"
  >
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-ink">{{ name }}</p>
      <p class="mt-0.5 text-xs text-ink-muted">{{ videoCount }}本</p>
    </div>
    <span class="pr-1 text-ink-muted transition group-active:translate-x-0.5">›</span>
  </RouterLink>
</template>
