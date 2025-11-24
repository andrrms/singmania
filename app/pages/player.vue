<script setup lang="ts">
definePageMeta({
	layout: 'player'
})
import { onMounted, onBeforeUnmount } from 'vue'
import { useKeyModifier, useIdle, useStorage } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useSongStore } from '~/stores/song'

const router = useRouter()
const songStore = useSongStore()

onMounted(() => {
	if (!songStore.song) {
		router.push('/')
	}
})

const handleBack = () => {
	songStore.reset()
	router.push('/')
}

// Safety cleanup if component is unmounted without going back (e.g. browser back button)
onBeforeUnmount(() => {
	// We don't necessarily want to clear state here if we are just transitioning, 
	// but if we are leaving the player, we might want to cleanup.
	// However, handleBack does the explicit cleanup. 
	// If user uses browser back button, we might leave blobs in memory until page refresh.
	// For now, let's rely on handleBack or the fact that index.vue will overwrite state.
})
</script>

<template>
	<div class="min-h-screen bg-black">
		<KaraokePlayer v-if="songStore.song" :song="songStore.song" :song-id="songStore.songId"
			:audio-src="songStore.audioSrc" :background-src="songStore.backgroundSrc" :cover-src="songStore.coverSrc"
			:gap-offset="songStore.gapOffset" :is-video-background="songStore.isVideoBackground"
			:youtube-id="songStore.youtubeId" @back="handleBack" />
	</div>
</template>
