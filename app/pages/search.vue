<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInfiniteScroll, useDebounceFn } from '@vueuse/core'
import { parseUltraStar } from '~/utils/ultrastarParser'
import { useSongStore } from '~/stores/song'
import { useSearchStore } from '~/stores/search'
import { useLibrary, type SongListItem } from '~/composables/useLibrary'
import SongCard from '~/components/SongCard.vue'

const route = useRoute()
const router = useRouter()
const songStore = useSongStore()
const searchStore = useSearchStore()
const { songs, loading, search, fetchSongs, loadMore } = useLibrary()

const searchInput = ref<HTMLInputElement | null>(null)
const scrollerWrapper = ref<HTMLElement | null>(null)
const selectedFilter = ref<'All' | 'YouTube' | 'Local' | 'Duet'>('All')
const viewMode = ref<'grid' | 'list' | 'grid-list'>('grid')

const fetchSuggestions = useDebounceFn(async (query: string) => {
	if (!query || query.length < 2) {
		searchStore.suggestions = []
		return
	}
	try {
		const response = await $fetch<{ data: SongListItem[] }>('/api/songs', {
			query: {
				search: query,
				limit: 5
			}
		})
		searchStore.suggestions = response.data
	} catch (e) {
		console.error(e)
	}
}, 300)

// Sync search store with useLibrary
watch(() => searchStore.searchQuery, (val) => {
	search.value = val
	fetchSuggestions(val)
})

// Audio Context for Click Sound
let audioContext: AudioContext | null = null

onMounted(() => {
	// Focus input
	if (searchInput.value) {
		searchInput.value.focus()
	}

	// Initialize Audio Context
	try {
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
	} catch (e) {
		console.error('Web Audio API not supported')
	}

	// Handle Query Param
	if (route.query.q) {
		searchStore.setQuery(route.query.q as string)
	}
})

useInfiniteScroll(
	scrollerWrapper,
	() => {
		loadMore()
	},
	{ distance: 100 }
)

// Play Mechanical Click Sound (Noise Burst)
const playClickSound = () => {
	if (!audioContext) return
	if (audioContext.state === 'suspended') audioContext.resume()

	const t = audioContext.currentTime
	const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate)
	const output = noiseBuffer.getChannelData(0)
	for (let i = 0; i < output.length; i++) {
		output[i] = Math.random() * 2 - 1
	}

	const noise = audioContext.createBufferSource()
	noise.buffer = noiseBuffer

	const noiseFilter = audioContext.createBiquadFilter()
	noiseFilter.type = 'highpass'
	noiseFilter.frequency.value = 1000

	const noiseEnvelope = audioContext.createGain()
	noiseEnvelope.gain.setValueAtTime(0.05, t)
	noiseEnvelope.gain.exponentialRampToValueAtTime(0.001, t + 0.05)

	noise.connect(noiseFilter)
	noiseFilter.connect(noiseEnvelope)
	noiseEnvelope.connect(audioContext.destination)

	noise.start(t)
}

// Watch input for sound
watch(() => searchStore.searchQuery, (newVal, oldVal) => {
	if (newVal !== oldVal) {
		playClickSound()
	}
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
	youtubeId: s.youtubeId
})

const getCoverUrl = (song: SongListItem) => {
	if (song.cover) {
		return song.cover.startsWith('http') ? song.cover : `/songs/${encodeURIComponent(song.cover)}`
	}
	if (song.youtubeId) {
		return `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`
	}
	return ''
}

const selectSuggestion = (suggestion: SongListItem) => {
	loadSong(suggestion)
	searchStore.suggestions = []
}
</script>

<template>
	<div class="h-full flex relative overflow-hidden">

		<!-- Left Column: Search & Autocomplete -->
		<div class="w-1/3 max-w-md h-full flex flex-col p-8 gap-8 relative z-20">
			<div class="space-y-2">
				<h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
					Pesquisar
				</h1>
				<p class="text-white/60 text-sm">Encontre sua próxima performance.</p>
			</div>

			<div class="relative group">
				<div
					class="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition-opacity">
				</div>
				<div
					class="relative flex items-center bg-black/40 border border-white/10 rounded-2xl px-4 py-3 gap-3 focus-within:border-white/50 transition-colors">
					<ClientOnly>
						<Icon name="material-symbols:search-rounded" class="text-white/50 w-6 h-6" />
					</ClientOnly>
					<input ref="searchInput" v-model="searchStore.searchQuery" type="text" placeholder="Música, Artista..."
						class="bg-transparent border-none outline-none text-white placeholder-white/30 w-full font-medium text-lg"
						autofocus />
				</div>

				<!-- Suggestions Dropdown -->
				<div v-if="searchStore.suggestions.length > 0 && searchStore.searchQuery"
					class="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
					<div class="px-4 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">SUGESTÕES</div>
					<div v-for="suggestion in searchStore.suggestions" :key="suggestion.filename"
						@click="selectSuggestion(suggestion)"
						class="px-4 py-3 hover:bg-white/10 cursor-pointer text-white/80 hover:text-white transition-colors flex items-center gap-3 group">
						<!-- Cover -->
						<div class="w-10 h-10 rounded bg-white/10 overflow-hidden shrink-0 relative">
							<img v-if="getCoverUrl(suggestion)" :src="getCoverUrl(suggestion)" class="w-full h-full object-cover" />
							<Icon v-else name="material-symbols:music-note-rounded" class="w-full h-full p-2 text-white/20" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="font-bold text-white text-sm truncate">{{ suggestion.title }}</div>
							<div class="text-white/50 text-xs truncate">{{ suggestion.artist }}</div>
						</div>
						<div v-if="suggestion.isDuet"
							class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">
							Duet
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Right Column: Results Grid -->
		<div class="flex-1 h-full flex flex-col overflow-hidden">

			<!-- Filters Header -->
			<div class="p-8 pb-4 flex items-center justify-end z-20">
				<!-- View Toggle -->
				<!-- View Toggle -->
				<div class="flex bg-white/5 rounded-xl p-1 gap-1 backdrop-blur-sm h-[44px] items-center">
					<button @click="viewMode = 'grid'"
						class="p-2 rounded-lg transition-colors h-full aspect-square flex items-center justify-center"
						:class="viewMode === 'grid' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'">
						<Icon name="material-symbols:grid-view-rounded" class="w-5 h-5" />
					</button>
					<button @click="viewMode = 'list'"
						class="p-2 rounded-lg transition-colors h-full aspect-square flex items-center justify-center"
						:class="viewMode === 'list' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'">
						<Icon name="material-symbols:view-list-rounded" class="w-5 h-5" />
					</button>
					<button @click="viewMode = 'grid-list'"
						class="p-2 rounded-lg transition-colors h-full aspect-square flex items-center justify-center"
						:class="viewMode === 'grid-list' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'">
						<Icon name="material-symbols:view-comfy-rounded" class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Grid -->
			<div class="flex-1 overflow-y-auto p-8 custom-scrollbar" ref="scrollerWrapper">
				<!-- Start Searching State -->
				<div v-if="!searchStore.searchQuery.trim()"
					class="h-full flex flex-col items-center justify-center text-white/30 gap-4">
					<Icon name="material-symbols:search-rounded" class="w-16 h-16" />
					<p class="text-lg font-medium">Digite para começar a pesquisar...</p>
				</div>

				<div v-else-if="loading && songs.length === 0" class="flex items-center justify-center h-64">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
				</div>

				<div v-else-if="songs.length > 0" :class="[
					viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-20' : '',
					viewMode === 'list' ? 'flex flex-col gap-2 pb-20' : '',
					viewMode === 'grid-list' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-20' : ''
				]">

					<template v-if="viewMode === 'grid'">
						<SongCard v-for="song in songs" :key="song.filename" :song="getSongForCard(song)" @click="loadSong(song)" />
					</template>

					<template v-else>
						<div v-for="song in songs" :key="song.filename + 'list'" @click="loadSong(song)"
							class="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group border border-transparent hover:border-white/10">
							<!-- Cover -->
							<div class="w-14 h-14 rounded-lg bg-white/10 overflow-hidden shrink-0 relative">
								<img v-if="song.cover" :src="getCoverUrl(song)" class="w-full h-full object-cover" />
								<div v-else class="w-full h-full flex items-center justify-center text-white/20">
									<Icon name="material-symbols:music-note-rounded" class="w-6 h-6" />
								</div>
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<h3 class="font-bold text-white text-base truncate group-hover:text-violet-300 transition-colors">
									{{ song.title }}
								</h3>
								<p class="text-white/60 text-sm truncate">{{ song.artist }}</p>
							</div>

							<!-- Badges -->
							<div class="flex items-center gap-4">
								<span v-if="song.isDuet"
									class="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase">Duet</span>
							</div>
						</div>
					</template>
				</div>

				<!-- Load More Spinner -->
				<div v-if="loading && songs.length > 0" class="py-8 flex justify-center">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
				</div>

				<!-- Empty State -->
				<div v-else class="h-full flex flex-col items-center justify-center text-white/30 gap-4">
					<Icon name="material-symbols:search-off-rounded" class="w-16 h-16" />
					<p class="text-lg font-medium">Nenhuma música encontrada</p>
				</div>
			</div>

		</div>

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
