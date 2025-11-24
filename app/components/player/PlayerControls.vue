<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  isReady: boolean
}>()

const emit = defineEmits<{
  (e: 'update:playing', value: boolean): void
  (e: 'update:volume', value: number): void
}>()
</script>

<template>
  <div class="flex flex-col-reverse items-center gap-4 relative group">
    <!-- Background Blob -->
    <div class="absolute inset-0 bg-black/40 blur-xl rounded-full -z-10 scale-150"></div>

    <!-- Play/Pause -->
    <button @click="emit('update:playing', !playing)" :disabled="!isReady"
      class="p-4 rounded-full bg-white text-black hover:bg-violet-400 hover:text-white transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.3)] border-4 border-transparent hover:border-white/50 aspect-square flex items-center justify-center z-10">
      <Icon v-if="playing" name="material-symbols:pause-rounded" class="w-8 h-8" />
      <Icon v-else name="material-symbols:play-arrow-rounded" class="w-8 h-8 ml-1" />
      <span class="sr-only">{{ playing ? 'Pause' : 'Play' }}</span>
    </button>

    <!-- Volume Control (Vertical) -->
    <div
      class="flex flex-col items-center gap-2 bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/10 transition-all duration-300">
      <Icon name="material-symbols:volume-up-rounded" class="w-5 h-5 text-white/80" />
      <div class="h-32 w-8 flex items-center justify-center relative">
        <input type="range" min="0" max="1" step="0.01" :value="volume"
          @input="emit('update:volume', parseFloat(($event.target as HTMLInputElement).value))"
          class="absolute -rotate-90 w-32 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all origin-center" />
      </div>
    </div>
  </div>
</template>
