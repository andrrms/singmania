<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
	score: number
	totalMaxScore?: number
	rating: string
	lastFeedback: { text: string, type: string, count: number } | null
	goldenNoteHit: boolean
	singerP1?: string
	singerP2?: string
	selectedPlayer?: number
}>()

// Animation state for score
const scoreScale = ref(1)
const scoreColor = ref('text-white')

watch(() => props.goldenNoteHit, (hit) => {
	if (hit) {
		scoreScale.value = 1.5
		scoreColor.value = 'text-yellow-400'
		setTimeout(() => {
			scoreScale.value = 1
			scoreColor.value = 'text-white'
		}, 300)
	}
})

// Computed classes for feedback
const feedbackClass = computed(() => {
	if (!props.lastFeedback) return ''
	switch (props.lastFeedback.type) {
		case 'perfect': return 'text-yellow-400 scale-125 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]'
		case 'excellent': return 'text-cyan-400 scale-110 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]'
		case 'good': return 'text-green-400 scale-100'
		default: return 'text-white/80 scale-90'
	}
})

const playerName = computed(() => {
	if (props.selectedPlayer === 1) return props.singerP1 || 'Player 1'
	if (props.selectedPlayer === 2) return props.singerP2 || 'Player 2'
	return 'Dueto'
})
</script>

<template>
	<div class="flex flex-col items-start transform -rotate-3 select-none pointer-events-none relative p-8">
		<!-- Background Blob for Legibility -->
		<div class="absolute inset-0 bg-black/40 blur-2xl rounded-full -z-10"></div>

		<!-- Player Name Badge (if relevant) -->
		<div v-if="selectedPlayer || singerP1 || singerP2"
			class="mb-2 px-4 py-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-full transform skew-x-[-10deg] -rotate-6">
			<span class="text-sm font-black uppercase tracking-widest text-white/90 not-italic">
				{{ playerName }}
			</span>
		</div>

		<!-- Rating Text (Above Score) -->
		<div class="mb-2 ms-2 -skew-x-[12deg] -rotate-6">
			<span class="text-xl font-black uppercase tracking-widest text-white/60 italic">
				{{ rating }}
			</span>
		</div>

		<!-- Score Counter -->
		<div class="relative">
			<!-- Background Glow for Gold Hit -->
			<div v-if="goldenNoteHit" class="absolute inset-0 bg-yellow-500/50 blur-xl rounded-full animate-ping-slow"></div>

			<div class="relative flex items-baseline gap-2 transition-all duration-300 -skew-x-[12deg] -rotate-6"
				:class="[scoreScale > 1 ? 'scale-110' : 'scale-100']">
				<span class="text-6xl font-black tracking-tighter tabular-nums transition-colors duration-300 drop-shadow-2xl"
					:class="scoreColor">
					{{ Math.round(score).toLocaleString() }}
				</span>
				<span class="text-sm font-bold uppercase tracking-widest text-white/40">pts</span>
			</div>
		</div>

		<!-- Progress Bar (Thicker, No Rounded, Gold Glow) -->
		<div class="w-full h-4 bg-black/50 mt-1 overflow-hidden border border-white/10 relative -skew-x-[12deg] -rotate-6">
			<div class="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-1000 relative z-10"
				:class="{ 'from-yellow-400 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.8)]': goldenNoteHit }"
				:style="{ width: `${Math.min(100, (score / (totalMaxScore || 10000)) * 100)}%` }">
			</div>
			<!-- Gold Shine Effect -->
			<div v-if="goldenNoteHit" class="absolute inset-0 bg-white/50 z-20 animate-pulse"></div>
		</div>

		<!-- Feedback Text (Below Bar with Skew) -->
		<div class="relative h-12 w-64 flex items-center mt-4 -skew-x-[12deg] -rotate-6">
			<transition enter-active-class="transition-all duration-200 ease-out cubic-bezier(0.34, 1.56, 0.64, 1)"
				enter-from-class="opacity-0 translate-y-4 scale-50 rotate-12"
				enter-to-class="opacity-100 translate-y-0 scale-100 rotate-0"
				leave-active-class="transition-all duration-150 ease-in absolute" leave-from-class="opacity-100 scale-100"
				leave-to-class="opacity-0 scale-150 blur-sm">
				<span v-if="lastFeedback" :key="lastFeedback.count"
					class="absolute text-5xl font-black uppercase tracking-tighter italic drop-shadow-lg stroke-text"
					:class="feedbackClass">
					{{ lastFeedback.text }}
				</span>
			</transition>
		</div>
	</div>
</template>

<style scoped>
.stroke-text {
	-webkit-text-stroke: 2px rgba(0, 0, 0, 0.5);
	paint-order: stroke fill;
}

.animate-ping-slow {
	animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {

	75%,
	100% {
		transform: scale(2);
		opacity: 0;
	}
}
</style>
