<script setup lang="ts">
import { computed } from 'vue'
import type { SavedSong } from '~/utils/db'

const props = defineProps<{
	song: SavedSong | any
	coverSrc?: string
}>()

const emit = defineEmits<{
	(e: 'click'): void
}>()

const coverUrl = computed(() => {
	if (props.coverSrc) return props.coverSrc
	if (props.song.coverBlob) {
		return URL.createObjectURL(props.song.coverBlob)
	}
	if (props.song.youtubeId) {
		return `https://img.youtube.com/vi/${props.song.youtubeId}/mqdefault.jpg`
	}
	return '' // Fallback or placeholder
})
</script>

<template>
	<div @click="emit('click')"
		class="group relative aspect-[4/3] rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] ring-0 hover:ring-4 ring-white/20">

		<!-- Background Image -->
		<div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
			:style="{ backgroundImage: `url(${coverUrl})` }">
		</div>

		<!-- Gradient Overlay -->
		<div
			class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity">
		</div>

		<!-- Content -->
		<div class="absolute inset-0 p-6 flex flex-col justify-end">

			<!-- Tags -->
			<div
				class="flex gap-2 mb-2 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
				<span v-if="song.youtubeId"
					class="px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">
					YouTube
				</span>
				<span v-else class="px-2 py-1 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
					Local
				</span>
			</div>

			<h3
				class="text-2xl font-black text-white leading-tight drop-shadow-lg transform group-hover:-translate-y-1 transition-transform duration-300">
				{{ song.title }}
			</h3>
			<p
				class="text-white/80 font-medium text-sm drop-shadow-md transform group-hover:-translate-y-1 transition-transform duration-300 delay-75">
				{{ song.artist }}
			</p>

			<!-- High Score Badge -->
			<div v-if="song.highScore"
				class="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 flex items-center gap-1">
				<ClientOnly>
					<Icon name="material-symbols:trophy-rounded" class="text-yellow-400 w-4 h-4" />
				</ClientOnly>
				<span class="text-xs font-bold text-yellow-100">{{ Math.round(song.highScore).toLocaleString() }}</span>
			</div>

		</div>

		<!-- Hover Shine Effect -->
		<div
			class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000">
		</div>
	</div>
</template>
