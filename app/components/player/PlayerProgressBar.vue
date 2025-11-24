<script setup lang="ts">
import { computed } from 'vue'
import type { UltraStarNote } from '~/utils/ultrastarParser'

const props = defineProps<{
	currentTime: number
	duration: number
	notes: UltraStarNote[]
	intervals?: { start: number, end: number }[]
}>()

// Calculate markers for special sections
const markers = computed(() => {
	if (!props.duration) return []

	const items: { left: string, width: string, type: 'freestyle' | 'golden' }[] = []

	// Group freestyle sections? Or just individual notes?
	// Let's just render individual golden notes and freestyle blocks

	props.notes.forEach(note => {
		if (!note.startTime || !note.endTime) return

		const startPct = (note.startTime / props.duration) * 100
		const widthPct = ((note.endTime - note.startTime) / props.duration) * 100

		if (note.type === 'F') {
			items.push({
				left: `${startPct}%`,
				width: `${Math.max(0.5, widthPct)}%`,
				type: 'freestyle'
			})
		} else if (note.type === '*' || note.type === 'G') {
			items.push({
				left: `${startPct}%`,
				width: `${Math.max(0.5, widthPct)}%`, // Ensure visible width
				type: 'golden'
			})
		}
	})

	return items
})

const intervalMarkers = computed(() => {
	if (!props.duration || !props.intervals) return []
	return props.intervals.map(int => ({
		left: `${(int.start / props.duration) * 100}%`,
		width: `${((int.end - int.start) / props.duration) * 100}%`
	}))
})

const progressPct = computed(() => {
	if (!props.duration) return 0
	return Math.min(100, (props.currentTime / props.duration) * 100)
})
</script>

<template>
	<div class="w-full h-2 bg-white/10 relative overflow-hidden">
		<!-- Markers -->
		<div v-for="(marker, i) in markers" :key="i" class="absolute top-0 bottom-0 opacity-80" :class="{
			'bg-blue-400': marker.type === 'freestyle',
			'bg-yellow-400': marker.type === 'golden'
		}" :style="{ left: marker.left, width: marker.width }">
		</div>

		<!-- Interval Markers -->
		<div v-for="(int, i) in intervalMarkers" :key="'int-' + i" class="absolute top-0 bottom-0 bg-white/20"
			:style="{ left: int.left, width: int.width }">
		</div>

		<!-- Progress Fill -->
		<div
			class="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-white transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(255,255,255,0.5)]"
			:style="{ width: `${progressPct}%` }">
			<!-- Leading glow -->
			<div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-white rounded-full blur-sm">
			</div>
		</div>
	</div>
</template>
