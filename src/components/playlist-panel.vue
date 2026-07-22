<script setup lang="ts">
withDefaults(
  defineProps<{
    playlistId: string
    name: string
    videoCount: number
    showHandle?: boolean
  }>(),
  { showHandle: true },
)
</script>

<template>
  <div class="flex items-center gap-1 bg-surface p-1">
    <span
      v-if="showHandle"
      class="drag-handle shrink-0 cursor-grab touch-none px-1 py-2 text-lg leading-none text-ink-muted"
      aria-hidden="true"
    >
      ⋮⋮
    </span>
    <RouterLink
      :to="{ name: 'playlist', params: { playlistId } }"
      class="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-4 transition active:scale-[0.98] active:bg-surface-overlay"
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-ink">{{ name }}</p>
        <p class="mt-0.5 text-xs text-ink-muted">{{ videoCount }}本</p>
      </div>
      <span class="pr-1 text-ink-muted transition group-active:translate-x-0.5">›</span>
    </RouterLink>
  </div>
</template>
