<script setup lang="ts">
import { computed } from 'vue'
import type { NoteStats } from '~/utils/db'

const props = defineProps<{
	score: number
	totalMaxScore: number
	rank: string
	songTitle: string
	songArtist: string
	coverSrc?: string
	youtubeId?: string
	difficulty: string
	noteStats: NoteStats
	totalNotes: number
	goldHit: number
	goldTotal: number
}>()

const emit = defineEmits<{
	(e: 'restart'): void
	(e: 'back'): void
}>()

// Calculate stars (0-5)
const stars = computed(() => {
	if (props.totalMaxScore === 0) return 0
	const pct = props.score / props.totalMaxScore
	if (pct >= 0.9) return 5
	if (pct >= 0.8) return 4
	if (pct >= 0.6) return 3
	if (pct >= 0.4) return 2
	if (pct >= 0.2) return 1
	return 0
})

const ratingText = computed(() => {
	if (props.difficulty === 'Freestyle') return 'Freestyle'
	const pct = props.score / props.totalMaxScore
	if (pct >= 0.95) return 'Lendário!'
	if (pct >= 0.9) return 'Incrível!'
	if (pct >= 0.8) return 'Super!'
	if (pct >= 0.7) return 'Ótimo!'
	if (pct >= 0.6) return 'Bom'
	return 'Tente de novo...'
})
</script>

<template>
	<div class="absolute inset-0 z-50 flex items-center justify-center animate-fade-in backdrop-blur-xl bg-black/60">
		<div class="flex flex-col items-center gap-8 p-8 max-w-6xl w-full text-center">

			<!-- Freestyle End Screen -->
			<div v-if="difficulty === 'Freestyle'" class="space-y-4 animate-slide-up">
				<h2 class="text-6xl font-black text-white tracking-tighter drop-shadow-2xl uppercase">Música Finalizada</h2>
				<p class="text-2xl text-blue-300 font-light tracking-widest uppercase">Sessão Livre Concluída</p>
			</div>

			<!-- Scored End Screen -->
			<div v-else class="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center animate-slide-up text-left">

				<!-- Left: Song Info & Vinyl -->
				<div class="lg:col-span-4 flex flex-col items-center gap-8">
					<div class="relative w-72 h-72 group">
						<!-- Vinyl Record -->
						<div
							class="absolute inset-0 rounded-full bg-black border-4 border-white/10 shadow-2xl flex items-center justify-center overflow-hidden animate-[spin_10s_linear_infinite]">
							<div class="absolute inset-0 bg-[repeating-radial-gradient(#111_0,#111_2px,#222_3px,#222_4px)]"></div>
							<!-- Cover Art -->
							<div class="w-1/2 h-1/2 rounded-full overflow-hidden border-4 border-black relative z-10">
								<img :src="coverSrc || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`"
									class="w-full h-full object-cover" />
							</div>
						</div>
						<!-- Rank Badge (Absolute) -->
						<div
							class="absolute -bottom-6 -right-6 w-28 h-28 flex items-center justify-center bg-violet-600 rounded-full border-4 border-white shadow-xl z-20 transform">
							<span class="text-6xl font-black text-white">{{ rank }}</span>
						</div>
					</div>

					<div class="text-center space-y-2">
						<h2 class="text-3xl font-black text-white uppercase leading-tight">{{ songTitle }}</h2>
						<p class="text-violet-300 font-bold uppercase tracking-widest text-lg">{{ songArtist }}</p>
					</div>
				</div>

				<!-- Center: Score & Stars -->
				<div class="lg:col-span-4 flex flex-col items-center justify-center gap-6">
					<!-- Inclined Rating Text -->
					<h3
						class="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 uppercase tracking-tighter italic transform -rotate-6 drop-shadow-lg">
						{{ ratingText }}
					</h3>

					<!-- Stars -->
					<div class="flex gap-2">
						<Icon v-for="i in 5" :key="i" name="material-symbols:star-rounded"
							class="w-12 h-12 drop-shadow-lg transition-all duration-500"
							:class="i <= stars ? 'text-yellow-400 scale-110' : 'text-white/20 scale-90'"
							:style="{ transitionDelay: `${i * 100}ms` }" />
					</div>

					<div class="flex flex-col items-center mt-4">
						<span class="text-white/40 text-sm font-bold uppercase tracking-widest">Pontuação Final</span>
						<span
							class="text-7xl font-black text-white tabular-nums tracking-tighter drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]">
							{{ Math.round(score).toLocaleString() }}
						</span>
					</div>
				</div>

				<!-- Right: Stats -->
				<div
					class="lg:col-span-4 flex flex-col gap-6 w-full bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
					<h3 class="text-xl font-bold text-white uppercase tracking-wider mb-2">Estatísticas</h3>

					<!-- Stat Bars -->
					<div class="space-y-5">
						<!-- Golden Notes (New) -->
						<div class="space-y-1">
							<div class="flex justify-between text-xs font-bold uppercase tracking-wider">
								<span class="text-yellow-400 flex items-center gap-1">
									<Icon name="material-symbols:star-rounded" class="w-4 h-4" />
									Golden Notes
								</span>
								<span class="text-white">{{ goldHit }} / {{ goldTotal }}</span>
							</div>
							<div class="h-3 bg-white/10 rounded-full overflow-hidden">
								<div
									class="h-full bg-gradient-to-r from-yellow-300 to-yellow-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(234,179,8,0.5)]"
									:style="{ width: `${goldTotal > 0 ? (goldHit / goldTotal) * 100 : 0}%` }"></div>
							</div>
						</div>

						<!-- Perfect/Excellent/Good/Ok Bars -->
						<div class="space-y-1">
							<div class="flex justify-between text-xs font-bold uppercase tracking-wider">
								<span class="text-cyan-400">Excellent</span>
								<span class="text-white">{{ noteStats.excellent }}</span>
							</div>
							<div class="h-2 bg-white/10 rounded-full overflow-hidden">
								<div class="h-full bg-cyan-400 transition-all duration-1000 ease-out"
									:style="{ width: `${(noteStats.excellent / (totalNotes || 1)) * 100}%` }"></div>
							</div>
						</div>

						<div class="space-y-1">
							<div class="flex justify-between text-xs font-bold uppercase tracking-wider">
								<span class="text-green-400">Good</span>
								<span class="text-white">{{ noteStats.good }}</span>
							</div>
							<div class="h-2 bg-white/10 rounded-full overflow-hidden">
								<div class="h-full bg-green-400 transition-all duration-1000 ease-out"
									:style="{ width: `${(noteStats.good / (totalNotes || 1)) * 100}%` }"></div>
							</div>
						</div>

						<div class="space-y-1">
							<div class="flex justify-between text-xs font-bold uppercase tracking-wider">
								<span class="text-white/60">Ok</span>
								<span class="text-white">{{ noteStats.ok }}</span>
							</div>
							<div class="h-2 bg-white/10 rounded-full overflow-hidden">
								<div class="h-full bg-white/40 transition-all duration-1000 ease-out"
									:style="{ width: `${(noteStats.ok / (totalNotes || 1)) * 100}%` }"></div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-6 mt-4">
				<button @click="emit('restart')"
					class="group relative px-10 py-5 bg-white text-black font-black text-xl uppercase tracking-wider hover:bg-violet-400 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(167,139,250,0.5)] rounded-xl">
					<span class="relative z-10 flex items-center gap-2">
						<Icon name="material-symbols:replay-rounded" class="w-6 h-6" />
						Repetir
					</span>
				</button>

				<button @click="emit('back')"
					class="group px-10 py-5 border-2 border-white/30 text-white font-bold text-xl uppercase tracking-wider hover:bg-white/10 hover:border-white transition-all duration-300 hover:scale-105 rounded-xl">
					<span class="flex items-center gap-2">
						<Icon name="material-symbols:home-rounded" class="w-6 h-6" />
						Voltar ao Menu
					</span>
				</button>
			</div>
		</div>
	</div>
</template>
