<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSongData } from '~/composables/useSongData'

const router = useRouter()
const songData = useSongData()

onMounted(() => {
	if (!songData.value.song) {
		router.push('/')
	}
})

const handleBack = () => {
	// Cleanup URLs to avoid memory leaks
	if (songData.value.audioSrc && songData.value.audioSrc.startsWith('blob:')) {
		URL.revokeObjectURL(songData.value.audioSrc)
	}
	if (songData.value.backgroundSrc && songData.value.backgroundSrc.startsWith('blob:')) {
		URL.revokeObjectURL(songData.value.backgroundSrc)
	}
	
	// Reset state
	songData.value = {
		song: null,
		audioSrc: '',
		backgroundSrc: undefined,
		isVideoBackground: false,
		youtubeId: undefined
	}
	
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
		<KaraokePlayer 
			v-if="songData.song"
			:song="songData.song" 
			:song-id="songData.songId"
			:audio-src="songData.audioSrc" 
			:background-src="songData.backgroundSrc"
			:gap-offset="songData.gapOffset"
			:is-video-background="songData.isVideoBackground" 
			:youtube-id="songData.youtubeId" 
			@back="handleBack" 
		/>
	</div>
</template>