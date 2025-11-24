<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { parseUltraStar } from '~/utils/ultrastarParser'
import { useSongStore } from '~/stores/song'
import { useSearchStore } from '~/stores/search'
import { useLibrary, type SongListItem } from '~/composables/useLibrary'
import SongCarousel from '~/components/SongCarousel.vue'

const router = useRouter()
const songStore = useSongStore()
const searchStore = useSearchStore()
const { songs, fetchSongs, loading } = useLibrary()

onMounted(async () => {
	searchStore.clear()
	if (songs.value.length === 0) {
		await fetchSongs()
	}
})

// Computed Categories
const recentSongs = computed(() => {
	// Since we don't have addedAt, just show the first 20
	return songs.value.slice(0, 20)
})

const duetSongs = computed(() => {
	return songs.value.filter(s => s.isDuet).slice(0, 20)
})

const allSongsCarousel = computed(() => {
	return songs.value.slice(0, 20)
})

const loadSong = async (songItem: SongListItem) => {
	songStore.reset()
	try {
		const songContent = await $fetch<string>(`/api/songs/${encodeURIComponent(songItem.filename)}`)

		if (!songContent) {
			throw new Error('Failed to load song content')
		}

		const song = parseUltraStar(songContent)

		let audioSrc = ''
		let backgroundSrc: string | undefined = undefined
		let coverSrc: string | undefined = undefined

		const getAssetUrl = (val: string) => `/songs/${val}`

		if (song.metadata.MP3) audioSrc = getAssetUrl(song.metadata.MP3)
		if (song.metadata.COVER) coverSrc = getAssetUrl(song.metadata.COVER)

		// Check if VIDEO is a local file or YouTube ID
		if (song.metadata.VIDEO) {
			if (!song.metadata.VIDEO.includes('v=') && !song.metadata.VIDEO.includes('a=')) {
				backgroundSrc = getAssetUrl(song.metadata.VIDEO)
			}
		}

		if (song.metadata.BACKGROUND && !backgroundSrc) backgroundSrc = getAssetUrl(song.metadata.BACKGROUND)

		songStore.setSong({
			song: song,
			songId: undefined,
			audioSrc: audioSrc,
			backgroundSrc: backgroundSrc,
			coverSrc: coverSrc,
			gapOffset: 0,
			isVideoBackground: !!song.metadata.VIDEO,
			youtubeId: songItem.youtubeId
		})

		router.push('/player')
	} catch (e) {
		console.error('Falha ao carregar música', e)
		alert('Falha ao carregar música.')
	}
}

// Mock SavedSong for SongCard compatibility
const getSongForCard = (s: SongListItem): any => ({
	id: 0,
	title: s.title,
	artist: s.artist,
	txtContent: '',
	isVideoBackground: false,
	addedAt: 0,
	coverBlob: undefined,
	coverSrc: s.cover ? (s.cover.startsWith('http') ? s.cover : `/songs/${s.cover}`) : undefined,
	youtubeId: s.youtubeId,
	filename: s.filename
})

const songsForCard = computed(() => songs.value.map(getSongForCard))
const recentSongsForCard = computed(() => recentSongs.value.map(getSongForCard))
const duetSongsForCard = computed(() => duetSongs.value.map(getSongForCard))
const allSongsForCard = computed(() => allSongsCarousel.value.map(getSongForCard))

</script>

<template>
	<div class="h-full flex flex-col">
		<!-- Main Content -->
		<main class="flex-1 h-full overflow-y-auto relative z-10 custom-scrollbar">

			<div class="px-8 pb-20 space-y-12 pt-4">

				<!-- Hero Banner -->
				<div class="relative w-full h-[340px] rounded-[40px] overflow-hidden group">
					<div
						class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
					</div>
					<div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>

					<div class="absolute inset-0 p-12 flex flex-col justify-center items-start max-w-5xl">
						<span
							class="px-3 py-1 bg-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg mb-4">Destaque</span>
						<h2 class="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
							Solte a sua
							<span class="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Voz
								Interior</span>
						</h2>
						<p class="text-lg text-white/80 mb-8 font-medium">
							Explore milhares de músicas, cante com amigos e divirta-se como nunca antes.
						</p>
						<button @click="router.push('/library')"
							class="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-lg shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all hover:scale-105">
							Começar Agora
						</button>
					</div>
				</div>

				<!-- Recent Songs -->
				<SongCarousel title="Adicionados Recentemente" :songs="recentSongsForCard" @select="loadSong" :loading="loading">
					<template #icon>
						<ClientOnly>
							<Icon name="material-symbols:schedule-rounded" class="text-violet-400" />
						</ClientOnly>
					</template>
				</SongCarousel>

				<!-- Duets -->
				<SongCarousel title="Duetos para Cantar Junto" :songs="duetSongsForCard" @select="loadSong" :loading="loading">
					<template #icon>
						<ClientOnly>
							<Icon name="material-symbols:group-rounded" class="text-fuchsia-400" />
						</ClientOnly>
					</template>
				</SongCarousel>

				<!-- All Songs -->
				<SongCarousel title="Todas as Músicas" :songs="allSongsForCard" @select="loadSong" :loading="loading">
					<template #icon>
						<ClientOnly>
							<Icon name="material-symbols:library-music-rounded" class="text-blue-400" />
						</ClientOnly>
					</template>
				</SongCarousel>

			</div>
		</main>

		<!-- Modals -->
		<!-- <AddSongModal :is-open="isAddModalOpen" @close="isAddModalOpen = false" @save="handleSaveSong" /> -->
	</div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
	background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
	border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.3);
}
</style>
