<script setup lang="ts">
import { useLoaderStore } from '~/stores/loader'
import { computed, watch, onUnmounted } from 'vue'

const loaderStore = useLoaderStore()

const percentage = computed(() => {
	if (loaderStore.total === 0) return 0
	return Math.round((loaderStore.progress / loaderStore.total) * 100)
})

// Prevent scrolling when loading
watch(() => loaderStore.isLoading, (isLoading) => {
	if (import.meta.client) {
		document.body.style.overflow = isLoading ? 'hidden' : ''
	}
}, { immediate: true })

onUnmounted(() => {
	if (import.meta.client) {
		document.body.style.overflow = ''
	}
})
</script>

<template>
	<Transition name="fade">
		<div v-if="loaderStore.isLoading" 
			class="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center p-8 select-none cursor-wait"
			@click.stop.prevent
			@touchmove.prevent
		>
			<!-- Background Effects -->
			<div class="absolute inset-0 overflow-hidden pointer-events-none">
				<div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[120px] animate-pulse"></div>
				<div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/20 rounded-full blur-[120px] animate-pulse" style="animation-delay: 1s;"></div>
				<div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
			</div>

			<!-- Logo/Title -->
			<div class="relative z-10 flex flex-col items-center mb-16 scale-110">
				<div class="relative mb-6">
					<div class="absolute inset-0 bg-violet-500 blur-xl opacity-50 animate-pulse"></div>
					<Icon name="material-symbols:mic-rounded" class="relative w-20 h-20 text-white animate-bounce" />
				</div>
				<h1 class="text-7xl font-black text-white tracking-tighter mb-4 drop-shadow-2xl">
					Sing<span class="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Mania!</span>
				</h1>
				<p class="text-white/50 font-medium tracking-[0.2em] uppercase text-sm">Preparando o Palco</p>
			</div>

			<!-- Progress Bar Container (Only if new songs) -->
			<div v-if="loaderStore.showProgress" class="w-full max-w-xl space-y-6 relative z-10 bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
				<div class="flex justify-between items-end text-white font-bold">
					<span class="text-lg text-white/80">Carregando biblioteca...</span>
					<span class="text-4xl tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">{{ percentage }}%</span>
				</div>
				
				<div class="h-6 bg-black/40 rounded-full overflow-hidden border border-white/5 p-1 shadow-inner">
					<div 
						class="h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-white rounded-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(217,70,239,0.5)] relative"
						:style="{ width: `${percentage}%` }"
					>
						<div class="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
					</div>
				</div>

				<div class="flex flex-col items-center gap-3 pt-2">
					<p class="text-white/60 text-xs font-mono truncate max-w-md h-4 text-center">
						{{ loaderStore.currentFile }}
					</p>
					<div class="flex items-center gap-2 text-white/30 text-[10px] uppercase tracking-widest font-bold">
						<Icon name="material-symbols:library-music-rounded" class="w-3 h-3" />
						<span>{{ loaderStore.progress }} / {{ loaderStore.total }} músicas</span>
					</div>
				</div>
			</div>

			<!-- Simple Loading State (No new songs) -->
			<div v-else class="relative z-10 flex flex-col items-center gap-4">
				<Icon name="svg-spinners:3-dots-fade" class="w-12 h-12 text-white/40" />
				<p class="text-white/40 text-sm font-medium animate-pulse">Iniciando...</p>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease, filter 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  filter: blur(10px);
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
