<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'

const props = defineProps<{
  videoId: string
  playing: boolean
  volume: number
}>()

const emit = defineEmits<{
  (e: 'ready', duration: number): void
  (e: 'ended'): void
  (e: 'update:currentTime', time: number): void
  (e: 'update:playing', playing: boolean): void
}>()

let ytPlayer: any = null
const playerTarget = ref<HTMLElement | null>(null)
let timeUpdateInterval: any = null
const duration = ref(0)

const loadYoutubeAPI = () => {
  return new Promise<void>((resolve) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve()
      return
    }
    const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName('script')[0]
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
    } else {
      document.head.appendChild(tag)
    }
    ; (window as any).onYouTubeIframeAPIReady = () => resolve()
  })
}

const initYoutubePlayer = async () => {
  await loadYoutubeAPI()

  if (!playerTarget.value) return

  ytPlayer = new (window as any).YT.Player(playerTarget.value, {
    videoId: props.videoId,
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0, // Hide YT controls
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3, // Hide annotations
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      origin: window.location.origin
    },
    events: {
      onReady: (event: any) => {
        duration.value = event.target.getDuration()
        event.target.setVolume(props.volume * 100)
        emit('ready', duration.value)
        if (props.playing) {
          event.target.playVideo()
        }
      },
      onStateChange: (event: any) => {
        // 1 = Playing, 2 = Paused
        if (event.data === 1) {
          emit('update:playing', true)
        }
        if (event.data === 2) {
          emit('update:playing', false)
        }
        if (event.data === 0) {
          emit('ended')
          emit('update:playing', false)
        }
      }
    }
  })

  // Manual loop to update time (YT doesn't have frequent 'timeupdate' event)
  timeUpdateInterval = setInterval(() => {
    if (ytPlayer && ytPlayer.getCurrentTime) {
      const time = ytPlayer.getCurrentTime()
      if (time !== undefined) {
        // Detect loop (time jump from near end to near start)
        if (duration.value > 0 && time > duration.value - 1 && time < 1) {
          emit('ended')
        }
        emit('update:currentTime', time)
      }
    }
  }, 100)
}

onMounted(() => {
  initYoutubePlayer()
})

onUnmounted(() => {
  if (timeUpdateInterval) clearInterval(timeUpdateInterval)
  if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy()
})

watch(() => props.playing, (shouldPlay) => {
  if (ytPlayer && ytPlayer.playVideo) {
    shouldPlay ? ytPlayer.playVideo() : ytPlayer.pauseVideo()
  }
})

watch(() => props.volume, (vol) => {
  if (ytPlayer && ytPlayer.setVolume) {
    ytPlayer.setVolume(vol * 100)
  }
})

const seekTo = (time: number) => {
  if (ytPlayer && ytPlayer.seekTo) {
    ytPlayer.seekTo(time, true)
  }
}

defineExpose({ seekTo })
</script>

<template>
  <div class="w-full h-full">
    <div ref="playerTarget" class="w-full h-full"></div>
  </div>
</template>
