<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { UltraStarSong } from '~/utils/ultrastarParser'
import { parseUltraStar } from '~/utils/ultrastarParser'
import { saveSong, getSongs, deleteSong, clearSongs, type SavedSong } from '~/utils/db'
import { useSongData } from '~/composables/useSongData'

const router = useRouter()
const songData = useSongData()
const savedSongs = ref<(SavedSong & { coverUrl?: string })[]>([])
const isLoadingLibrary = ref(true)

const searchQuery = ref('')
const sortOrder = ref<'added' | 'title' | 'artist'>('added')
const filterType = ref<'all' | 'duet' | 'solo'>('all')

const filteredSongs = computed(() => {
	let result = savedSongs.value

	// Filter
	if (filterType.value === 'duet') {
		result = result.filter(s => {
			// Check metadata for duet indicators
			// We need to parse the TXT content to be sure, but we can check if we saved metadata?
			// SavedSong interface has title, artist.
			// Let's do a quick check on the raw content if possible, or just assume we need to parse.
			// Parsing every song might be slow.
			// Let's check if we can detect duet from content string quickly.
			return s.txtContent.includes('P2') || s.txtContent.includes('DUETSINGERP1')
		})
	} else if (filterType.value === 'solo') {
		result = result.filter(s => {
			return !s.txtContent.includes('P2') && !s.txtContent.includes('DUETSINGERP1')
		})
	}

	// Search
	if (searchQuery.value) {
		const q = searchQuery.value.toLowerCase()
		result = result.filter(s => 
			s.title.toLowerCase().includes(q) || 
			s.artist.toLowerCase().includes(q)
		)
	}

	// Sort
	result = [...result].sort((a, b) => {
		if (sortOrder.value === 'added') return b.addedAt - a.addedAt
		if (sortOrder.value === 'title') return a.title.localeCompare(b.title)
		if (sortOrder.value === 'artist') return a.artist.localeCompare(b.artist)
		return 0
	})

	return result
})

const isDuet = (song: SavedSong) => {
	return song.txtContent.includes('P2') || song.txtContent.includes('DUETSINGERP1')
}

const refreshSongs = async () => {
	isLoadingLibrary.value = true
	try {
		// Revoke old URLs
		savedSongs.value.forEach(s => {
			if (s.coverUrl) URL.revokeObjectURL(s.coverUrl)
		})

		const songs = await getSongs()
		// Initial sort by addedAt desc
		songs.sort((a, b) => b.addedAt - a.addedAt)
		
		savedSongs.value = songs.map(s => ({
			...s,
			coverUrl: s.coverBlob ? URL.createObjectURL(s.coverBlob) : undefined
		}))
	} catch (e) {
		console.error('Falha ao carregar músicas salvas', e)
	} finally {
		isLoadingLibrary.value = false
	}
}

onMounted(() => {
	refreshSongs()
})

const cleanupUrls = () => {
	if (songData.value.audioSrc && songData.value.audioSrc.startsWith('blob:')) {
		URL.revokeObjectURL(songData.value.audioSrc)
	}
	if (songData.value.backgroundSrc && songData.value.backgroundSrc.startsWith('blob:')) {
		URL.revokeObjectURL(songData.value.backgroundSrc)
	}
}

const handleReady = async (data: { 
	song: UltraStarSong, 
	audioSrc?: string, 
	backgroundSrc?: string, 
	isVideoBackground: boolean, 
	youtubeId?: string,
	txtContent?: string,
	audioFile?: File,
	backgroundFile?: File,
	coverFile?: Blob
}) => {
	cleanupUrls() // Cleanup previous if any
	
	// Update Store
	songData.value = {
		song: data.song,
		audioSrc: data.audioSrc || '',
		backgroundSrc: data.backgroundSrc,
		isVideoBackground: data.isVideoBackground,
		youtubeId: data.youtubeId
	}

	// Save to Cache
	let savedId: number | undefined = undefined
	if (data.txtContent) {
		try {
			savedId = await saveSong({
				title: data.song.metadata.TITLE || 'Desconhecido',
				artist: data.song.metadata.ARTIST || 'Desconhecido',
				txtContent: data.txtContent,
				audioBlob: data.audioFile,
				backgroundBlob: data.backgroundFile,
				coverBlob: data.coverFile,
				isVideoBackground: data.isVideoBackground,
				youtubeId: data.youtubeId,
				addedAt: Date.now()
			})
			await refreshSongs()
		} catch (e) {
			console.error('Falha ao salvar música no cache', e)
		}
	}
	
	// Update Store (after saving to get ID)
	songData.value = {
		song: data.song,
		songId: savedId,
		audioSrc: data.audioSrc || '',
		backgroundSrc: data.backgroundSrc,
		gapOffset: 0,
		isVideoBackground: data.isVideoBackground,
		youtubeId: data.youtubeId
	}
	
	router.push('/player')
}

const loadSavedSong = (saved: SavedSong) => {
	cleanupUrls() // Cleanup previous if any
	try {
		const song = parseUltraStar(saved.txtContent)
		let audioSrc = ''
		let backgroundSrc: string | undefined = undefined

		if (saved.audioBlob) {
			audioSrc = URL.createObjectURL(saved.audioBlob)
		}

		if (saved.backgroundBlob) {
			backgroundSrc = URL.createObjectURL(saved.backgroundBlob)
		} else if (saved.isVideoBackground && saved.audioBlob) {
			// If video was used as background and it's the same file (no separate bg file)
			backgroundSrc = audioSrc
		}

		// Update Store
		songData.value = {
			song: song,
			songId: saved.id,
			audioSrc: audioSrc,
			backgroundSrc: backgroundSrc,
			gapOffset: saved.gapOffset || 0,
			isVideoBackground: saved.isVideoBackground,
			youtubeId: saved.youtubeId
		}
		
		router.push('/player')
	} catch (e) {
		console.error('Falha ao carregar música salva', e)
		alert('Falha ao carregar música do cache.')
	}
}

const removeSong = async (id: number) => {
	if (confirm('Remover esta música do cache?')) {
		await deleteSong(id)
		await refreshSongs()
	}
}

const clearCache = async () => {
	if (confirm('Limpar todas as músicas salvas? Isso não pode ser desfeito.')) {
		await clearSongs()
		await refreshSongs()
	}
}
</script>

<template>
	<div class="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col">
		<!-- Header -->
		<header class="w-full p-8 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
					<Icon name="material-symbols:mic" class="text-white w-6 h-6" />
				</div>
				<h1 class="text-3xl font-black tracking-tighter uppercase italic">Sing<span class="text-violet-500">Mania!</span></h1>
			</div>
		</header>

		<!-- Main Content -->
		<main class="flex-1 w-full max-w-[1600px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-12 h-full overflow-hidden">
			
			<!-- Left Column: New Song (Sticky) -->
			<div class="lg:col-span-5 flex flex-col justify-center h-full relative z-10">
				<div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">
					<div class="mb-8">
						<h2 class="text-4xl font-bold mb-2">Nova Música</h2>
						<p class="text-white/60">Carregue um arquivo UltraStar (.txt) para começar a cantar.</p>
					</div>
					
					<FileUpload @ready="handleReady" />
				</div>
			</div>

			<!-- Right Column: Library (Scrollable) -->
			<div class="lg:col-span-7 h-full flex flex-col relative z-10">
				<div class="flex flex-col gap-4 mb-6">
					<div class="flex items-center justify-between">
						<h2 class="text-2xl font-bold flex items-center gap-2">
							<Icon name="material-symbols:library-music-rounded" class="text-violet-400" />
							Sua Biblioteca
						</h2>
						<button v-if="savedSongs.length > 0" @click="clearCache" 
							class="text-xs text-red-400 hover:text-red-300 uppercase tracking-wider font-bold border border-red-500/30 px-3 py-1 rounded hover:bg-red-500/10 transition-colors flex items-center gap-1">
							<Icon name="material-symbols:delete-outline" />
							Limpar Cache
						</button>
					</div>

					<!-- Search and Filters -->
					<div class="flex flex-col md:flex-row gap-3">
						<div class="relative flex-1">
							<Icon name="material-symbols:search" class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
							<input v-model="searchQuery" type="text" placeholder="Buscar música ou artista..." 
								class="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all" />
						</div>
						<div class="flex gap-2">
							<select v-model="filterType" class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
								<option value="all">Todos</option>
								<option value="duet">Duetos</option>
								<option value="solo">Solo</option>
							</select>
							<select v-model="sortOrder" class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
								<option value="added">Recentes</option>
								<option value="title">Título</option>
								<option value="artist">Artista</option>
							</select>
						</div>
					</div>
				</div>

				<!-- Loading State -->
				<div v-if="isLoadingLibrary" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
					<div v-for="i in 4" :key="i" class="h-32 bg-white/5 rounded-xl border border-white/5"></div>
				</div>

				<!-- Empty State -->
				<div v-else-if="filteredSongs.length === 0" class="flex-1 flex flex-col items-center justify-center text-white/30 border-2 border-dashed border-white/10 rounded-3xl p-12">
					<Icon name="material-symbols:music-off-rounded" class="w-16 h-16 mb-4 opacity-50" />
					<p class="text-lg font-medium">Nenhuma música encontrada</p>
					<p class="text-sm" v-if="savedSongs.length === 0">Suas músicas carregadas aparecerão aqui.</p>
					<p class="text-sm" v-else>Tente ajustar seus filtros de busca.</p>
				</div>

				<!-- List -->
				<div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-20 custom-scrollbar">
					<div v-for="(song, index) in filteredSongs" :key="song.id" 
						class="group relative bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between h-32"
						@click="loadSavedSong(song)">
						
						<!-- Background Preview (if available) -->
						<div v-if="song.coverUrl || song.youtubeId" class="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-cover bg-center grayscale group-hover:grayscale-0 duration-500"
							:style="{ backgroundImage: `url(${song.coverUrl || `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`})` }"></div>
						
						<div class="relative z-10 flex justify-between items-start">
							<div class="flex-1 min-w-0 mr-4">
								<h3 class="font-bold text-lg leading-tight truncate text-white group-hover:text-violet-300 transition-colors" :title="song.title">{{ song.title }}</h3>
								<p class="text-white/50 text-sm font-medium truncate">{{ song.artist }}</p>
							</div>
							
							<button @click.stop="song.id && removeSong(song.id)" class="text-white/20 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-white/10">
								<Icon name="material-symbols:close-rounded" class="w-5 h-5" />
							</button>
						</div>

						<div class="relative z-10 flex items-center gap-2 mt-auto">
							<span class="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-black/50 backdrop-blur-md border border-white/10"
								:class="song.youtubeId ? 'text-red-400 border-red-500/20' : 'text-blue-400 border-blue-500/20'">
								<Icon :name="song.youtubeId ? 'material-symbols:youtube-activity' : 'material-symbols:folder-open-rounded'" class="w-3 h-3 inline mr-1" />
								{{ song.youtubeId ? 'YouTube' : 'Local' }}
							</span>
							<span v-if="isDuet(song)" class="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-violet-500/20 backdrop-blur-md border border-violet-500/30 text-violet-300">
								<Icon name="material-symbols:group-rounded" class="w-3 h-3 inline mr-1" />
								Dueto
							</span>
						</div>
					</div>
				</div>
			</div>
		</main>

		<!-- Background Ambient -->
		<div class="fixed inset-0 z-0 pointer-events-none">
			<div class="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px]"></div>
			<div class="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]"></div>
		</div>
	</div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.05);
	border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
	border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.3);
}
</style>
