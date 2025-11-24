<script setup lang="ts">
import { ref, computed } from 'vue'
import MicSetup from './MicSetup.vue'

const props = defineProps<{
	songTitle: string
	songArtist: string
	isReady: boolean
	micPermission: PermissionState | 'unknown'
	difficulties: string[]
	selectedDifficulty: string
	isDuet: boolean
	singerP1?: string
	singerP2?: string
	selectedPlayer?: number
}>()

const emit = defineEmits<{
	(e: 'back'): void
	(e: 'start'): void
	(e: 'request-mic'): void
	(e: 'update:difficulty', value: string): void
	(e: 'update:player', value: number | undefined): void
}>()

</script>

<template>
	<div
		class="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl transition-all duration-500">
		<div class="flex flex-col items-center gap-8 p-8 max-w-5xl w-full text-center animate-fade-in relative">

			<!-- Decorative Background Elements -->
			<div
				class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-3xl bg-violet-500/10 blur-[100px] rounded-full -z-10">
			</div>

			<!-- Song Info -->
			<div class="space-y-2 mb-8 transform hover:scale-105 transition-transform duration-500">
				<h1 class="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl uppercase italic">
					{{ songTitle }}
				</h1>
				<p class="text-2xl md:text-3xl text-violet-300 font-bold tracking-widest uppercase">{{ songArtist }}</p>
			</div>

			<div v-if="!isReady" class="flex flex-col items-center gap-6 py-12">
				<div class="relative">
					<div class="w-16 h-16 border-4 border-white/10 border-t-violet-500 rounded-full animate-spin"></div>
					<div class="absolute inset-0 flex items-center justify-center">
						<Icon name="material-symbols:music-note-rounded" class="w-6 h-6 text-violet-500 animate-pulse" />
					</div>
				</div>
				<p class="text-white/60 font-bold tracking-wider uppercase animate-pulse text-lg">Preparando Palco...</p>
			</div>

			<div v-else class="flex flex-col items-center gap-10 w-full animate-slide-up">

				<!-- Microphone Permission Screen -->
				<div v-if="micPermission !== 'granted'"
					class="flex flex-col items-center gap-8 max-w-lg bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
					<div class="flex items-center justify-center">
						<div
							class="p-8 rounded-full bg-violet-500/20 border-4 border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.3)] aspect-square flex items-center justify-center animate-pulse-ring">
							<Icon name="material-symbols:mic-rounded" class="w-16 h-16 text-white" />
						</div>
					</div>

					<div class="space-y-2">
						<h3 class="text-3xl font-black text-white uppercase tracking-wider italic">Microfone Necessário</h3>
						<p class="text-white/70 text-lg">Para a mágica acontecer, precisamos ouvir sua voz!</p>
					</div>

					<div class="flex flex-col gap-4 w-full">
						<button @click="emit('request-mic')"
							class="w-full px-8 py-4 bg-white text-black font-black text-xl uppercase tracking-wider rounded-xl transition-all hover:bg-violet-300 hover:scale-105 shadow-lg flex items-center justify-center gap-3">
							<Icon name="material-symbols:check-circle-rounded" class="w-6 h-6" />
							Ativar Microfone
						</button>

						<button @click="emit('back')"
							class="text-white/40 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors py-2">
							Voltar
						</button>
					</div>
				</div>

				<!-- Game Start Screen (Only if Mic Granted) -->
				<div v-else class="flex flex-col items-center gap-10 w-full">

					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl items-stretch">
						<!-- Difficulty Selection -->
						<div
							class="flex flex-col gap-4 items-center bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
							<div class="flex items-center gap-2 text-white/60 mb-2">
								<Icon name="material-symbols:speed-rounded" class="w-5 h-5" />
								<p class="text-sm font-bold uppercase tracking-widest">Dificuldade</p>
							</div>

							<div class="flex flex-wrap gap-3 justify-center">
								<button v-for="diff in difficulties" :key="diff" @click="emit('update:difficulty', diff)"
									class="px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 border-2 min-w-[100px]"
									:class="selectedDifficulty === diff
										? 'bg-violet-500 border-violet-500 text-white scale-105 shadow-lg'
										: 'bg-transparent border-white/10 text-white/40 hover:border-white/30 hover:text-white/80'">
									{{ diff }}
								</button>
							</div>

							<!-- Info Text -->
							<div class="h-12 flex items-center justify-center text-center">
								<p v-if="selectedDifficulty === 'SingStar!'"
									class="text-yellow-400 text-xs font-bold uppercase tracking-widest animate-pulse">
									<Icon name="material-symbols:warning-rounded" class="inline w-4 h-4 -mt-0.5 mr-1" />
									Modo Expert: Precisão Extrema!
								</p>
								<p v-if="selectedDifficulty === 'Freestyle'"
									class="text-blue-400 text-xs font-bold uppercase tracking-widest">
									<Icon name="material-symbols:mic-external-on-rounded" class="inline w-4 h-4 -mt-0.5 mr-1" />
									Modo Livre: Sem Pontuação
								</p>
							</div>
						</div>

						<!-- Player Selection (Duet) -->
						<div v-if="isDuet"
							class="flex flex-col gap-4 items-center bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
							<div class="flex items-center gap-2 text-white/60 mb-2">
								<Icon name="material-symbols:group-rounded" class="w-5 h-5" />
								<p class="text-sm font-bold uppercase tracking-widest">Cantores</p>
							</div>

							<div class="flex flex-col gap-3 w-full">
								<button @click="emit('update:player', undefined)"
									class="w-full px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 border-2 flex items-center justify-between group"
									:class="selectedPlayer === undefined
										? 'bg-violet-500 border-violet-500 text-white shadow-lg'
										: 'bg-transparent border-white/10 text-white/40 hover:border-white/30 hover:text-white/80'">
									<span>Dueto (Ambos)</span>
									<Icon name="material-symbols:check-circle-rounded"
										class="w-5 h-5 opacity-0 group-[.bg-violet-500]:opacity-100" />
								</button>

								<div class="flex gap-3">
									<button @click="emit('update:player', 1)"
										class="flex-1 px-3 py-2 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 border-2 text-sm"
										:class="selectedPlayer === 1
											? 'bg-blue-500 border-blue-500 text-white shadow-lg'
											: 'bg-transparent border-white/10 text-white/40 hover:border-white/30 hover:text-white/80'">
										{{ singerP1 || 'P1' }}
									</button>
									<button @click="emit('update:player', 2)"
										class="flex-1 px-3 py-2 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 border-2 text-sm"
										:class="selectedPlayer === 2
											? 'bg-pink-500 border-pink-500 text-white shadow-lg'
											: 'bg-transparent border-white/10 text-white/40 hover:border-white/30 hover:text-white/80'">
										{{ singerP2 || 'P2' }}
									</button>
								</div>
							</div>
						</div>

						<!-- Placeholder for Solo (to keep grid balanced if not duet) -->
						<div v-else
							class="flex flex-col gap-4 items-center justify-center bg-white/5 p-6 rounded-2xl border border-white/10 opacity-50">
							<Icon name="material-symbols:person-rounded" class="w-12 h-12 text-white/20" />
							<p class="text-white/40 text-sm font-bold uppercase tracking-widest">Modo Solo</p>
						</div>

						<!-- Mic Setup -->
						<MicSetup />
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-wrap justify-center gap-6 mt-4">
						<button @click="emit('back')"
							class="group px-8 py-5 border-2 border-white/30 text-white font-bold text-xl uppercase tracking-wider hover:bg-white/10 hover:border-white transition-all duration-300 hover:scale-105 rounded-xl">
							<span class="flex items-center gap-2">
								<Icon name="material-symbols:arrow-back-rounded" class="w-6 h-6" />
								Voltar
							</span>
						</button>

						<button @click="emit('start')"
							class="group relative px-16 py-5 bg-white text-black font-black text-2xl uppercase tracking-wider hover:bg-violet-400 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(167,139,250,0.6)] rounded-xl overflow-hidden">
							<div
								class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-200%] group-hover:animate-shine">
							</div>
							<span class="relative z-10 flex items-center gap-3">
								<Icon name="material-symbols:play-arrow-rounded" class="w-8 h-8" />
								Iniciar Show
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
@keyframes shine {
	0% {
		transform: translateX(-200%);
	}

	100% {
		transform: translateX(200%);
	}
}

@keyframes pulse-ring {
	0% {
		box-shadow: 0 0 30px rgba(139, 92, 246, 0.3), 0 0 0 0 rgba(139, 92, 246, 0.5);
	}

	50% {
		box-shadow: 0 0 40px rgba(139, 92, 246, 0.5), 0 0 0 20px rgba(139, 92, 246, 0);
	}

	100% {
		box-shadow: 0 0 30px rgba(139, 92, 246, 0.3), 0 0 0 0 rgba(139, 92, 246, 0);
	}
}

.animate-shine {
	animation: shine 1s ease-in-out;
}

.animate-pulse-ring {
	animation: pulse-ring 2s ease-out infinite;
}
</style>
