<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useMediaControls } from '@vueuse/core'

const props = defineProps<{
  audioSrc: string
  backgroundSrc?: string
  isVideoBackground: boolean
  playing: boolean
  volume: number
  videoGap: number
}>()

const emit = defineEmits<{
  (e: 'ready', duration: number): void
  (e: 'ended'): void
  (e: 'update:currentTime', time: number): void
  (e: 'update:playing', playing: boolean): void
}>()

const audioRef = ref<HTMLAudioElement>()
const videoRef = ref<HTMLVideoElement>()

const {
  playing: audioPlaying,
  currentTime: audioTime,
  duration: audioDuration,
  volume: audioVolume
} = useMediaControls(audioRef, {
  src: props.audioSrc,
})

watch(audioPlaying, (v) => emit('update:playing', v))
watch(audioTime, (v) => emit('update:currentTime', v))
watch(audioDuration, (v) => {
  if (v > 0) emit('ready', v)
})

// Sync props to controls
watch(() => props.playing, (v) => audioPlaying.value = v)
watch(() => props.volume, (v) => audioVolume.value = v)

// Sync video with audio
watch(() => props.playing, (isPlaying) => {
  if (videoRef.value) {
    if (isPlaying) videoRef.value.play()
    else videoRef.value.pause()
  }
})

// Sync video time when seeking (or drifting)
watch(audioTime, (time) => {
  if (videoRef.value) {
    const targetTime = Math.max(0, time - props.videoGap)
    if (Math.abs(videoRef.value.currentTime - targetTime) > 0.5) {
      videoRef.value.currentTime = targetTime
    }
  }
})

onMounted(() => {
  if (audioRef.value) {
    audioRef.value.addEventListener('ended', () => {
      emit('ended')
      emit('update:playing', false)
    })
  }
})

const seekTo = (time: number) => {
  audioTime.value = time
}

defineExpose({ seekTo })
</script>

<template>
  <div class="w-full h-full">
    <video v-if="isVideoBackground && backgroundSrc" ref="videoRef" :src="backgroundSrc" loop muted
      class="w-full h-full object-cover transition-all duration-1000" />
    <img v-else-if="backgroundSrc" :src="backgroundSrc" class="w-full h-full object-cover transition-all duration-1000"
      alt="Background" />
    <div v-else class="w-full h-full bg-gradient-to-br from-gray-900 to-black" />

    <audio ref="audioRef" class="hidden" />
  </div>
</template>
