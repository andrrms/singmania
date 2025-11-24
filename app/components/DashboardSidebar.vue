<script setup lang="ts">
const emit = defineEmits<{
	(e: 'navigate', page: 'home' | 'search' | 'settings' | 'library'): void
}>()

import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'

const router = useRouter()
const route = useRoute()

const activePage = computed(() => {
	if (route.path === '/') return 'home'
	if (route.path.startsWith('/library')) return 'library'
	if (route.path.startsWith('/search')) return 'search'
	if (route.path.startsWith('/settings')) return 'settings'
	return ''
})

const navigate = (page: 'home' | 'search' | 'settings' | 'library') => {
	if (page === 'home') router.push('/')
	else if (page === 'library') router.push('/library')
	else if (page === 'search') router.push('/search')
	else if (page === 'settings') router.push('/settings')
}
</script>

<template>
	<div
		class="w-24 h-full flex flex-col items-center py-8 bg-black/40 backdrop-blur-xl border-r border-white/10 relative z-50">
		<!-- Logo Icon -->
		<div
			class="mb-12 w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.5)]">
			<ClientOnly>
				<Icon name="material-symbols:music-note-rounded" class="text-white w-7 h-7" />
			</ClientOnly>
		</div>

		<!-- Navigation -->
		<div class="flex-1 flex flex-col gap-8 w-full px-4">

			<button @click="navigate('home')"
				class="group relative w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300"
				:class="activePage === 'home' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-110' : 'text-white/50 hover:bg-white/10 hover:text-white'">
				<ClientOnly>
					<Icon name="material-symbols:home-rounded" class="w-8 h-8" />
				</ClientOnly>
				<div v-if="activePage === 'home'"
					class="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-fuchsia-500 rounded-l-full"></div>
			</button>

			<button @click="navigate('library')"
				class="group relative w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300"
				:class="activePage === 'library' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-110' : 'text-white/50 hover:bg-white/10 hover:text-white'">
				<ClientOnly>
					<Icon name="material-symbols:library-music-rounded" class="w-8 h-8" />
				</ClientOnly>
				<div v-if="activePage === 'library'"
					class="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-fuchsia-500 rounded-l-full"></div>
			</button>

			<button @click="navigate('search')"
				class="group relative w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300"
				:class="activePage === 'search' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-110' : 'text-white/50 hover:bg-white/10 hover:text-white'">
				<ClientOnly>
					<Icon name="material-symbols:search-rounded" class="w-8 h-8" />
				</ClientOnly>
				<div v-if="activePage === 'search'"
					class="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-fuchsia-500 rounded-l-full"></div>
			</button>

			<!-- <button @click="navigate('settings')"
				class="group relative w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-300"
				:class="activePage === 'settings' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-110' : 'text-white/50 hover:bg-white/10 hover:text-white'">
				<ClientOnly>
					<Icon name="material-symbols:settings-rounded" class="w-8 h-8" />
				</ClientOnly>
			</button> -->

		</div>

		<!-- User Profile (Mock) -->
		<!-- <div class="mt-auto">
			<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-cyan-400 border-2 border-white/20"></div>
		</div> -->
	</div>
</template>
