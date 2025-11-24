<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import DashboardSidebar from '~/components/DashboardSidebar.vue'
import ParticlesBackground from '~/components/ParticlesBackground.vue'
import AddSongModal from '~/components/AddSongModal.vue'
import { useSongStore } from '~/stores/song'
import { useSearchStore } from '~/stores/search'
import { useRouter, useRoute } from 'vue-router'
import { saveSong, getSongs } from '~/utils/db'
import { parseUltraStar, type UltraStarSong } from '~/utils/ultrastarParser'

const router = useRouter()
const route = useRoute()
const songStore = useSongStore()
const searchStore = useSearchStore()
const isAddModalOpen = ref(false)

// Global Search Redirection (Persistent across pages in this layout)
const handleGlobalKeydown = (e: KeyboardEvent) => {
	// Ignore if modal is open or modifier keys are pressed
	if (isAddModalOpen.value || e.ctrlKey || e.altKey || e.metaKey) return

	// Ignore if typing in an input
	const target = e.target as HTMLElement
	if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

	// Check if key is alphanumeric (single char) or space
	if (e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key)) {
		// If we are NOT on search page, start a new search
		if (!route.path.startsWith('/search')) {
			searchStore.setQuery(e.key)
			router.push('/search')
		} else {
			// If we are on search page, append only if input is not focused
			// (If input is focused, the native behavior handles it)
			// But wait, the check `if (target.tagName === 'INPUT' ...)` above handles the focused case.
			// So here we are definitely NOT focused on an input.
			searchStore.appendChar(e.key)
		}
	}
}

onMounted(() => {
	window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', handleGlobalKeydown)
})

const handleSaveSong = async (data: {
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
	if (data.txtContent) {
		try {
			await saveSong({
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
			// We might need to trigger a refresh in the active page, but for now this saves it.
			// Ideally we use a global store or event bus, but let's keep it simple.
			// The pages will refresh on mount.
		} catch (e) {
			console.error('Falha ao salvar música no cache', e)
		}
	}
}
</script>

<template>
	<div class="h-screen w-screen bg-black text-white font-sans overflow-hidden flex relative">
		<!-- Background -->
		<div class="fixed inset-0 z-0">
			<div class="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black"></div>
			<ParticlesBackground />
		</div>

		<!-- Sidebar -->
		<DashboardSidebar @navigate="(page) => console.log('Navigating to', page)" />

		<!-- Main Content Area -->
		<div class="flex-1 h-full flex flex-col relative z-10 overflow-hidden">

			<!-- Top Bar (Fixed in Layout) -->
			<div
				class="sticky top-0 z-50 px-8 py-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm shrink-0">
				<h1
					class="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
					SingMania!
				</h1>
				<!-- <button @click="isAddModalOpen = true"
					class="px-6 py-2 bg-white text-black rounded-full font-bold text-sm tracking-wide hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2">
					<ClientOnly>
						<Icon name="material-symbols:add-circle-rounded" class="w-5 h-5" />
					</ClientOnly>
					Adicionar Música
				</button> -->
			</div>

			<!-- Page Content Slot -->
			<div class="flex-1 overflow-hidden relative">
				<slot />
			</div>
		</div>

		<!-- Modals (Global) -->
		<!-- <AddSongModal :is-open="isAddModalOpen" @close="isAddModalOpen = false" @save="handleSaveSong" /> -->
	</div>
</template>
