<script setup lang="ts">
import { ref } from "vue"

const { disabled = false } = defineProps<{
  // 並び替えドラッグ中はSortable側にジェスチャーを完全に譲るためtrueにする。
  disabled?: boolean
}>()

const emit = defineEmits<{
  delete: []
}>()

const REVEAL_WIDTH_PX = 84
const OPEN_THRESHOLD_RATIO = 0.5
const OPEN_THRESHOLD_PX = REVEAL_WIDTH_PX * OPEN_THRESHOLD_RATIO
// この距離を横に動かすまでは「スワイプ」と確定させない。
// 確定前はポインタを一切奪わないので、ただのタップ(RouterLinkのクリック)はそのまま通る。
// 並び替え用の長押しドラッグ(Sortable側のtouchStartThreshold)より少しだけ大きい値にして、
// 「動かした」場合は必ずSortable側が先に諦めるようにしてある。
const SWIPE_ACTIVATION_PX = 10

const translateX = ref(0)
const isDragging = ref(false)
let isTracking = false
let startClientX = 0
let startClientY = 0
let startTranslateX = 0
let activePointerId: number | undefined

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const onPointerDown = (event: PointerEvent): void => {
  if (disabled) {
    return
  }
  isTracking = true
  startClientX = event.clientX
  startClientY = event.clientY
  startTranslateX = translateX.value
  activePointerId = event.pointerId
}

const onPointerMove = (event: PointerEvent): void => {
  if (disabled || !isTracking || event.pointerId !== activePointerId) {
    return
  }
  const dx = event.clientX - startClientX
  const dy = event.clientY - startClientY

  if (!isDragging.value) {
    const horizontalIntent = Math.abs(dx) > SWIPE_ACTIVATION_PX && Math.abs(dx) > Math.abs(dy)
    if (!horizontalIntent) {
      return
    }
    isDragging.value = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  translateX.value = clamp(startTranslateX + dx, -REVEAL_WIDTH_PX, 0)
}

const endDrag = (): void => {
  isTracking = false
  if (!isDragging.value) {
    return
  }
  isDragging.value = false
  translateX.value = translateX.value < -OPEN_THRESHOLD_PX ? -REVEAL_WIDTH_PX : 0
}

const close = (): void => {
  translateX.value = 0
}

const confirmDelete = (): void => {
  close()
  emit("delete")
}

defineExpose({ close })
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl">
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center bg-danger-500 text-sm font-semibold text-white"
      aria-label="削除"
      @click="confirmDelete"
    >
      削除
    </button>
    <div
      class="relative bg-surface"
      :class="isDragging ? '' : 'transition-transform duration-200'"
      :style="{ transform: `translateX(${translateX}px)` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <slot />
    </div>
  </div>
</template>
