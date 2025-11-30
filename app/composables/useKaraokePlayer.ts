import { ref, computed, watch, onUnmounted } from 'vue'
import { useStorage, useIdle } from '@vueuse/core'
import type { UltraStarSong } from '../utils/ultrastarParser'

export function useKaraokePlayer(props: {
	song: UltraStarSong
	gapOffset?: number
}) {
	// --- State ---
	const playing = ref(false)
	const currentTime = ref(0)
	const duration = ref(0)
	const isReady = ref(false)
	const hasEnded = ref(false)
	const volume = useStorage('karaoke-volume', 1)

	// Settings
	const globalOffset = ref(props.gapOffset || 0)
	const backgroundDim = ref(0.6)
	const lyricsScale = ref(1)

	// Watch for prop updates
	watch(() => props.gapOffset, (newVal) => {
		if (newVal !== undefined) {
			globalOffset.value = newVal
		}
	})

	// --- Computed ---
	const songBpm = computed(() => parseFloat(props.song.metadata['BPM']?.replace(',', '.') || '0'))
	const initialGap = parseFloat(props.song.metadata['GAP']?.replace(',', '.') || '0')
	const videoGap = computed(() => parseFloat(props.song.metadata['VIDEOGAP']?.replace(',', '.') || '0'))
	const songTitle = computed(() => props.song.metadata['TITLE'] || 'Título Desconhecido')
	const songArtist = computed(() => props.song.metadata['ARTIST'] || 'Artista Desconhecido')

	const firstNoteTime = computed(() => {
		if (props.song.lines.length === 0) return 0
		const firstLine = props.song.lines[0]
		return firstLine ? (firstLine.startTime || 0) : 0
	})

	const lastNoteTime = computed(() => {
		if (props.song.lines.length === 0) return 0
		const lastLine = props.song.lines[props.song.lines.length - 1]
		return lastLine ? (lastLine.endTime || 0) : 0
	})

	// --- Logic ---

	const seekTo = (time: number) => {
		currentTime.value = time
		// Note: The actual player component (Youtube/Local) needs to watch currentTime 
		// or expose a seek method. We'll handle this via the return values.
	}

	const restartSong = () => {
		seekTo(0)
		playing.value = true
		hasEnded.value = false
	}

	const handlePlayerReady = (dur: number) => {
		duration.value = dur
		isReady.value = true
	}

	const handlePlayerEnded = () => {
		hasEnded.value = true
		playing.value = false
	}

	// --- Intro/Outro Logic ---
	const introDuration = computed(() => {
		const start = firstNoteTime.value
		let targetDuration = 0

		if (start > 5) {
			targetDuration = start * 0.75
		} else {
			targetDuration = 5
		}

		const lyricsStartTime = Math.max(0, start - 1)
		return Math.min(targetDuration, lyricsStartTime)
	})

	const showIntro = computed(() => {
		if (currentTime.value <= 0.1) return false
		return currentTime.value < introDuration.value
	})

	const isLyricsFinished = computed(() => {
		return currentTime.value > (lastNoteTime.value + 2)
	})

	const isSongFinished = computed(() => {
		if (hasEnded.value) return true
		return duration.value > 0 && currentTime.value >= duration.value - 0.5
	})

	// --- Interval Logic ---
	// Moved from KaraokePlayer.vue to keep logic centralized
	const isInterval = ref(false)
	let intervalTimeout: any = null

	const handleIntervalUpdate = (active: boolean) => {
		if (active) {
			if (!isInterval.value && !intervalTimeout) {
				intervalTimeout = setTimeout(() => {
					isInterval.value = true
					intervalTimeout = null
				}, 2000)
			}
		} else {
			if (intervalTimeout) {
				clearTimeout(intervalTimeout)
				intervalTimeout = null
			}
			isInterval.value = false
		}
	}

	onUnmounted(() => {
		if (intervalTimeout) clearTimeout(intervalTimeout)
	})

	return {
		// State
		playing,
		currentTime,
		duration,
		isReady,
		hasEnded,
		volume,
		globalOffset,
		backgroundDim,
		lyricsScale,

		// Computed
		songBpm,
		initialGap,
		videoGap,
		songTitle,
		songArtist,
		firstNoteTime,
		lastNoteTime,
		introDuration,
		showIntro,
		isLyricsFinished,
		isSongFinished,
		isInterval,

		// Methods
		seekTo,
		restartSong,
		handlePlayerReady,
		handlePlayerEnded,
		handleIntervalUpdate
	}
}
