<script setup lang="ts">
import { computed, ref, watch, onUnmounted, onMounted } from 'vue'
import type { UltraStarLine, UltraStarNote } from '../utils/ultrastarParser'

const props = defineProps<{
	lines: UltraStarLine[]
	currentTime: number
	playing: boolean
	lyricsScale?: number
}>()

const emit = defineEmits<{
	(e: 'interval', active: boolean): void
}>()

const containerRef = ref<HTMLElement>()
const smoothTime = ref(props.currentTime)
let rafId: number | null = null
let anchorAudioTime = 0
let anchorSystemTime = 0

// High-Frequency Timing Loop
const loop = () => {
	if (!props.playing) {
		rafId = null
		return
	}

	const now = performance.now()
	// Calculate time based on anchor to prevent drift
	const expectedTime = anchorAudioTime + (now - anchorSystemTime) / 1000
	smoothTime.value = expectedTime

	rafId = requestAnimationFrame(loop)
}

watch(() => props.playing, (isPlaying) => {
	if (isPlaying) {
		anchorAudioTime = props.currentTime
		anchorSystemTime = performance.now()
		smoothTime.value = props.currentTime
		if (!rafId) {
			rafId = requestAnimationFrame(loop)
		}
	} else {
		if (rafId) {
			cancelAnimationFrame(rafId)
			rafId = null
		}
		// Snap to final time when paused
		smoothTime.value = props.currentTime
	}
}, { immediate: true })

// Also watch currentTime for seeks while paused AND for sync while playing
watch(() => props.currentTime, (newTime) => {
	if (props.playing) {
		const now = performance.now()
		const projectedTime = anchorAudioTime + (now - anchorSystemTime) / 1000
		const drift = Math.abs(projectedTime - newTime)

		// If drift is > 50ms, resync anchor to audio clock
		if (drift > 0.05) {
			anchorAudioTime = newTime
			anchorSystemTime = now
			smoothTime.value = newTime
		}
	} else {
		if (Math.abs(smoothTime.value - newTime) > 0.01) {
			smoothTime.value = newTime
		}
	}
})

onUnmounted(() => {
	if (rafId) cancelAnimationFrame(rafId)
})

// Find active line based on smoothTime
const processedLines = computed(() => {
	const result: UltraStarLine[] = []
	const rawLines = props.lines

	for (let i = 0; i < rawLines.length; i++) {
		const current = rawLines[i]
		if (!current) continue

		const next = rawLines[i + 1]

		// Check if current and next are identical in timing and text but different players
		if (next && 
			Math.abs((current.startTime || 0) - (next.startTime || 0)) < 0.1 &&
			Math.abs((current.endTime || 0) - (next.endTime || 0)) < 0.1 &&
			current.player !== next.player &&
			(current.player === 1 || current.player === 2) &&
			(next.player === 1 || next.player === 2)
		) {
			// Check text content
			const text1 = (current.words || []).map(w => w.notes.map(n => n.text).join('')).join('')
			const text2 = (next.words || []).map(w => w.notes.map(n => n.text).join('')).join('')

			if (text1 === text2) {
				// Merge into a single line with no specific player (center)
				result.push({
					...current,
					words: current.words || [],
					player: undefined // Center alignment
				})
				i++ // Skip next line
				continue
			}
		}
		result.push(current)
	}
	return result
})

const activeLineIndices = computed(() => {
	const indices: Set<number> = new Set()
	const time = smoothTime.value
	const lines = processedLines.value
	
	// Look ahead window - Increased for Duets to ensure fast lines are seen
	const LOOK_AHEAD = 2
	
	let hasActiveP1 = false
	let hasActiveP2 = false

	// 1. Find currently active lines
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (!line || !line.startTime || !line.endTime) continue

		if (time >= line.startTime && time <= line.endTime) {
			indices.add(i)
			if (line.player === 1 || line.player === undefined) hasActiveP1 = true
			if (line.player === 2 || line.player === undefined) hasActiveP2 = true
		}
	}

	// 2. Look ahead for upcoming lines for idle players
	// This ensures that if P1 is singing a long line, P2's upcoming fast lines are still shown
	if (!hasActiveP1 || !hasActiveP2) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			if (!line || !line.startTime) continue
			
			// Skip past lines or currently active ones
			if (time >= line.startTime) continue

			// Stop if too far ahead
			if (line.startTime - time > LOOK_AHEAD) break

			// If P1 is idle and this is a P1 line
			if (!hasActiveP1 && (line.player === 1 || line.player === undefined)) {
				indices.add(i)
				hasActiveP1 = true
			}

			// If P2 is idle and this is a P2 line
			if (!hasActiveP2 && (line.player === 2 || line.player === undefined)) {
				indices.add(i)
				hasActiveP2 = true
			}
			
			if (hasActiveP1 && hasActiveP2) break
		}
	}
	
	// Fallback: if nothing found (start of song), show the first upcoming line
	if (indices.size === 0) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			if (line && (line.startTime || 0) > time) {
				indices.add(i)
				// Try to find partner's first line too (for duets starting together or close)
				const firstPlayer = line.player
				for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
					const next = lines[j]
					if (next && next.player !== firstPlayer && next.player !== undefined) {
						indices.add(j)
						break
					}
				}
				break
			}
		}
	}
	
	// If still nothing (end of song), show last
	if (indices.size === 0 && lines.length > 0) {
		indices.add(lines.length - 1)
	}

	return Array.from(indices).sort((a, b) => a - b)
})

// Interval Detection
const currentInterval = computed(() => {
	// Use the first active line for interval calculation logic
	const index = activeLineIndices.value[0]
	if (index === undefined || index === 0) return null

	const prevLine = processedLines.value[index - 1]
	const nextLine = processedLines.value[index]

	if (!prevLine || !nextLine) return null

	const start = prevLine.endTime || 0
	const end = nextLine.startTime || 0
	const duration = end - start

	if (duration < 3) return null

	if (smoothTime.value > start && smoothTime.value < end) {
		return { start, end, duration }
	}

	return null
})

const isIntervalActive = computed(() => {
	if (!currentInterval.value) return false
	const { end, duration } = currentInterval.value
	const remaining = end - smoothTime.value
	return remaining > (duration * 0.25)
})

watch(isIntervalActive, (active) => {
	emit('interval', active)
})

const scrollToActiveLine = (behavior: ScrollBehavior = 'smooth') => {
	if (!containerRef.value || activeLineIndices.value.length === 0) return
	
	// Prioritize lines that have actually started (startTime <= currentTime)
	// If multiple lines are active, pick the latest one.
	// If no line is active (only lookahead), pick the first lookahead line.
	
	const indices = activeLineIndices.value
	const lines = processedLines.value
	const time = smoothTime.value
	
	let targetIndex = indices[0] // Default to first available
	
	// Find the last index that is "active" (time >= startTime)
	// This prevents scrolling too early to a lookahead line when another line is still being sung
	for (let i = indices.length - 1; i >= 0; i--) {
		const idx = indices[i]
		if (idx === undefined) continue
		const line = lines[idx]
		if (line && (line.startTime || 0) <= time + 0.5) { // Small buffer
			targetIndex = idx
			break
		}
	}
	
	if (targetIndex === undefined) return
	const lineElements = containerRef.value.children
	const el = lineElements[targetIndex]
	if (el) {
		el.scrollIntoView({ behavior, block: 'center' })
	}
}

// Auto-scroll to active line
watch(activeLineIndices, () => {
	scrollToActiveLine('smooth')
})

onMounted(() => {
	// Initial scroll (instant)
	scrollToActiveLine('auto')
})

const getNoteProgress = (note: UltraStarNote) => {
	const time = smoothTime.value
	if (!note.startTime || !note.endTime) return 0
	if (time < note.startTime) return 0
	if (time > note.endTime) return 100
	return ((time - note.startTime) / (note.endTime - note.startTime)) * 100
}

const isNoteActive = (note: UltraStarNote) => {
	const time = smoothTime.value
	if (!note.startTime || !note.endTime) return false
	return time >= note.startTime && time <= note.endTime
}

const isDuet = computed(() => {
	return props.lines.some(line => line.player === 2)
})
</script>

<template>
	<div class="relative w-full h-full max-w-6xl mx-auto">
		<!-- Interval Indicator -->
		<div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-opacity duration-500"
			:class="isIntervalActive ? 'opacity-100' : 'opacity-0'">
			<span class="text-4xl font-light text-white/50 tracking-widest uppercase animate-pulse">(Intervalo)</span>
		</div>

		<div ref="containerRef"
			class="w-full h-full overflow-hidden no-scrollbar flex flex-col gap-8 py-[50vh] px-8 md:px-16">
			<div v-for="(line, index) in processedLines" :key="index"
				class="transition-all duration-700 ease-out transform origin-center w-full py-4" :class="{
					'scale-110 opacity-100 blur-none': activeLineIndices.includes(index) && !isIntervalActive,
					'scale-100 opacity-40 blur-[2px]': !activeLineIndices.includes(index) && !isIntervalActive,
					'opacity-0 blur-md scale-95': isIntervalActive,
					'text-left pr-[50%]': isDuet && line.player === 1,
					'text-right pl-[50%]': isDuet && line.player === 2,
					'text-center': !isDuet || !line.player
				}">
				<div
				class="font-bold leading-normal tracking-tight text-white flex flex-wrap"
				:style="{ 
					fontSize: `${(lyricsScale || 1) * 3}rem`,
					gap: `${(lyricsScale || 1) * 0.5}rem ${(lyricsScale || 1) * 1}rem`
				}"
				:class="{
					'justify-start': isDuet && line.player === 1,
					'justify-end': isDuet && line.player === 2,
					'justify-center': !isDuet || !line.player
				}">
				<!-- Iterate Words -->
				<span v-for="(word, wIndex) in line.words" :key="wIndex" class="inline-flex">
					<!-- Iterate Notes in Word -->
					<span v-for="(note, nIndex) in word.notes" :key="nIndex" class="relative inline-block note-fill"
						:class="{
							'active-glow': isNoteActive(note) && note.type !== '*' && note.type !== 'G' && note.type !== 'R',
							'active-glow-golden': isNoteActive(note) && (note.type === '*' || note.type === 'G'),
							'active-glow-rap': isNoteActive(note) && note.type === 'R',
							'note-golden': note.type === '*' || note.type === 'G',
							'note-rap': note.type === 'R'
						}" :style="{ '--progress': `${getNoteProgress(note)}%` }">
						{{ note.text }}
					</span>
				</span>
			</div>
		</div>
	</div>
	</div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
	display: none;
}

.no-scrollbar {
	-ms-overflow-style: none;
	scrollbar-width: none;
}

.note-fill {
	/* Base/Inactive Color */
	color: rgba(255, 255, 255, 0.3);

	/* Active Color (Gradient) */
	background-image: linear-gradient(white, white);
	background-size: var(--progress) 100%;
	background-repeat: no-repeat;
	background-position: left center;

	/* Clip background to text */
	-webkit-background-clip: text;
	background-clip: text;

	/* Smooth transitions */
	transition: background-size 0.1s linear, text-shadow 0.2s ease-out, color 0.2s ease-out;
}

.active-glow {
	text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
}

.active-glow-golden {
	text-shadow: 0 0 20px rgba(255, 215, 0, 0.9), 0 0 10px rgba(255, 215, 0, 0.6);
}

.active-glow-rap {
	text-shadow: 0 0 15px rgba(0, 191, 255, 0.8);
}

.note-golden {
	color: rgba(255, 215, 0, 0.3);
}

.note-golden.note-fill {
	background-image: linear-gradient(#FFD700, #FFD700);
}

.note-rap {
	color: rgba(0, 191, 255, 0.3);
	font-style: italic;
}

.note-rap.note-fill {
	background-image: linear-gradient(#00BFFF, #00BFFF);
}
</style>
