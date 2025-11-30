<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useInfiniteScroll } from '@vueuse/core'
import { parseUltraStar } from '~/utils/ultrastarParser'
import { useSongStore } from '~/stores/song'
import { usePreferencesStore } from '~/stores/preferences'
import { useLibrary, type SongListItem } from '~/composables/useLibrary'
import SongCard from '~/components/SongCard.vue'
import SongCardSkeleton from '~/components/SongCardSkeleton.vue'

const router = useRouter()
const songStore = useSongStore()
const preferences = usePreferencesStore()
const { songs, loading, total, loadMore, sort, typeFilter, languageFilter, hasMore } = useLibrary()

const scrollerWrapper = ref<HTMLElement | null>(null)
const { data: availableLanguages } = await useFetch<string[]>('/api/languages')

const languageMap: Record<string, string> = {
	'English': 'Inglês',
	'Portuguese': 'Português (Portugal)',
	'Portuguese (Brazil)': 'Português',
	'Spanish': 'Espanhol',
	'Japanese': 'Japonês',
	'Korean': 'Coreano',
	'German': 'Alemão',
	'French': 'Francês',
	'Italian': 'Italiano',
	'Chinese': 'Chinês',
	'Russian': 'Russo'
}

const getLanguageLabel = (lang: string) => {
	return languageMap[lang] || lang
}

const filters = [
	{ label: 'Todas', value: 'all' },
	{ label: 'Duetos', value: 'duet' }
]

const sortOptions = [
	{ label: 'Título', value: 'title' },
	{ label: 'Artista', value: 'artist' },
	{ label: 'Data', value: 'date' }
]
const groupedSongs = computed(() => {
	const groups: Record<string, SongListItem[]> = {}

	songs.value.forEach(song => {
		let key = ''
		if (sort.value === 'title') {
			key = song.title.charAt(0).toUpperCase()
			if (!/[A-Z]/.test(key)) key = '#'
		} else if (sort.value === 'artist') {
			key = song.artist.charAt(0).toUpperCase()
			if (!/[A-Z]/.test(key)) key = '#'
		} else if (sort.value === 'date') {
			key = 'Recentes'
		}

		if (!groups[key]) groups[key] = []
		groups[key]!.push(song)
	})
	return groups
})

useInfiniteScroll(
	scrollerWrapper,
	() => {
		if (hasMore.value) {
			loadMore()
		}
	},
	{ distance: 100 }
)

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
			songId: undefined, // No DB ID anymore
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

const getCoverUrl = (song: SongListItem) => {
	if (song.cover) {
		return song.cover.startsWith('http') ? song.cover : `/songs/${encodeURIComponent(song.cover)}`
	}
	if (song.youtubeId) {
		return `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`
	}
	return ''
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
	coverSrc: s.cover ? (s.cover.startsWith('http') ? s.cover : `/songs/${encodeURIComponent(s.cover)}`) : undefined,
	youtubeId: s.youtubeId,
	filename: s.filename
})
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Header -->
		<header class="px-8 py-6 flex flex-col gap-6 z-20 shrink-0">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<h1 class="text-4xl font-black text-white drop-shadow-lg">
						Biblioteca
					</h1>
					<span
						class="px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-bold backdrop-blur-md border border-white/10">
						{{ total }} músicas
					</span>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex items-center justify-between">
				<!-- Filters -->
				<div class="flex items-center gap-4">
					<!-- Type Filters -->
					<div class="flex items-center gap-2 bg-white/5 p-1 rounded-xl backdrop-blur-sm">
						<button v-for="f in filters" :key="f.value" @click="typeFilter = f.value"
							class="px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap"
							:class="typeFilter === f.value ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/10'">
							{{ f.label }}
						</button>
					</div>

					<!-- Language Select -->
					<div class="relative">
						<select v-model="languageFilter"
							class="appearance-none bg-white/5 text-white/80 hover:text-white hover:bg-white/10 pl-4 pr-10 py-2 rounded-xl backdrop-blur-sm border border-white/5 focus:outline-none focus:border-white/20 transition-all text-sm font-bold cursor-pointer">
							<option value="all" class="bg-zinc-900 text-white">Todos os Idiomas</option>
							<option v-for="lang in availableLanguages" :key="lang" :value="lang" class="bg-zinc-900 text-white">
								{{ getLanguageLabel(lang) }}
							</option>
						</select>
						<Icon name="material-symbols:keyboard-arrow-down-rounded"
							class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
					</div>
				</div>

				<div class="flex items-center gap-6">
					<!-- Sort -->
					<div class="flex items-center gap-2 bg-white/5 p-1 rounded-xl backdrop-blur-sm">
						<button v-for="s in sortOptions" :key="s.value" @click="sort = s.value"
							class="px-4 py-2 rounded-lg text-sm font-bold transition-all uppercase"
							:class="sort === s.value ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/10'">
							{{ s.label }}
						</button>
					</div>

					<!-- View Mode -->
					<div class="flex bg-white/5 rounded-xl p-1 gap-1 backdrop-blur-sm h-[44px] items-center">
						<button @click="preferences.viewMode = 'grid'"
							class="p-2 rounded-lg transition-colors h-full aspect-square flex items-center justify-center"
							:class="preferences.viewMode === 'grid' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'">
							<Icon name="material-symbols:grid-view-rounded" class="w-5 h-5" />
						</button>
						<button @click="preferences.viewMode = 'list'"
							class="p-2 rounded-lg transition-colors h-full aspect-square flex items-center justify-center"
							:class="preferences.viewMode === 'list' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'">
							<Icon name="material-symbols:view-list-rounded" class="w-5 h-5" />
						</button>
						<button @click="preferences.viewMode = 'grid-list'"
							class="p-2 rounded-lg transition-colors h-full aspect-square flex items-center justify-center"
							:class="preferences.viewMode === 'grid-list' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'">
							<Icon name="material-symbols:view-comfy-rounded" class="w-5 h-5" />
						</button>
					</div>
				</div>
			</div>
		</header>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto custom-scrollbar pb-20 px-8" ref="scrollerWrapper">
			<div v-if="songs.length > 0">

				<div v-for="(groupSongs, groupName) in groupedSongs" :key="groupName" class="mb-8">
					<h2 class="text-2xl font-bold text-white/20 mb-4 px-2 uppercase">{{ groupName }}</h2>

					<!-- Grid View -->
					<div v-if="preferences.viewMode === 'grid'" class="grid gap-6 grid-auto-fit">
						<div v-for="song in groupSongs" :key="song.filename" class="relative group/card">
							<SongCard :song="getSongForCard(song)" @click="loadSong(song)" />
						</div>
					</div>

					<!-- List View -->
					<div v-else-if="preferences.viewMode === 'list'" class="flex flex-col gap-2">
						<div v-for="song in groupSongs" :key="song.filename" @click="loadSong(song)"
							class="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10">

							<!-- Cover -->
							<div class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
								<img v-if="getCoverUrl(song)" :src="getCoverUrl(song)" class="w-full h-full object-cover" />
								<Icon v-else name="material-symbols:music-note-rounded" class="w-6 h-6 text-white/50" />
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<h3 class="text-white font-bold truncate group-hover:text-violet-300 transition-colors">{{ song.title }}
								</h3>
								<p class="text-white/50 text-sm truncate">{{ song.artist }}</p>
							</div>

							<div v-if="song.isDuet" class="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold">
								Duet
							</div>
						</div>
					</div>

					<!-- Grid-List View -->
					<div v-else class="grid gap-4 grid-auto-fit">
						<div v-for="song in groupSongs" :key="song.filename" @click="loadSong(song)"
							class="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10">

							<!-- Cover -->
							<div class="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
								<img v-if="getCoverUrl(song)" :src="getCoverUrl(song)" class="w-full h-full object-cover" />
								<Icon v-else name="material-symbols:music-note-rounded" class="w-6 h-6 text-white/50" />
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<h3 class="text-white font-bold text-sm truncate group-hover:text-violet-300 transition-colors">{{
									song.title }}
								</h3>
								<p class="text-white/50 text-xs truncate">{{ song.artist }}</p>
							</div>

							<div v-if="song.isDuet"
								class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">
								Duet
							</div>
						</div>
					</div>
				</div>

				<!-- Load More Spinner -->
				<div v-if="loading" class="flex items-center justify-center py-8 w-full col-span-full">
					<Icon name="svg-spinners:90-ring-with-bg" class="w-10 h-10 text-white/50" />
				</div>
			</div>

			<!-- Empty State -->
			<div v-else-if="!loading"
				class="h-full flex flex-col items-center justify-center text-white/30 gap-4 min-h-[400px]">
				<Icon name="material-symbols:library-music-outline-rounded" class="w-20 h-20" />
				<p class="text-xl font-medium">Nenhuma música encontrada</p>
			</div>

			<!-- Initial Loading -->
			<div v-else class="grid gap-6 grid-auto-fit">
				<SongCardSkeleton v-for="i in 20" :key="i" />
			</div>
		</div>
	</div>
</template>

<style scoped>
.grid-auto-fit {
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.custom-scrollbar::-webkit-scrollbar {
	width: 8px;
	height: 8px;
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
