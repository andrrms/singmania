<script setup lang="ts">
import { useMediaControls, useKeyModifier, useIdle, useStorage } from '@vueuse/core'
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { UltraStarSong } from '../utils/ultrastarParser'
import { updateSong } from '../utils/db'

const props = defineProps<{
	song: UltraStarSong
	songId?: number
	audioSrc?: string
	backgroundSrc?: string
	gapOffset?: number
	isVideoBackground?: boolean
	youtubeId?: string
}>()

const emit = defineEmits<{
	(e: 'back'): void
}>()

// --- Unified State ---
const isYoutube = computed(() => !!props.youtubeId)
const isInterval = ref(false)
let intervalTimeout: any = null
const isReady = ref(false)
const showSettings = ref(false)
const globalOffset = ref(props.gapOffset || 0)
const originalOffset = ref(props.gapOffset || 0) // To track changes
const backgroundDim = ref(0.6)
const lyricsScale = ref(1)

watch(() => props.gapOffset, (newVal) => {
	if (newVal !== undefined) {
		globalOffset.value = newVal
		originalOffset.value = newVal
	}
})

const shiftPressed = useKeyModifier('Shift')
const hasEnded = ref(false)
const { idle: isIdle } = useIdle(3000) // Hide controls after 3s of inactivity

// Main control refs (used by UI)
const currentTime = ref(0)
const duration = ref(0)
const playing = ref(false)
const volume = useStorage('karaoke-volume', 1)

const songBpm = computed(() => parseFloat(props.song.metadata['BPM']?.replace(',', '.') || '0'))
const initialGap = parseFloat(props.song.metadata['GAP']?.replace(',', '.') || '0')
const localGap = ref(initialGap)
const songGap = computed(() => localGap.value)
const videoGap = computed(() => parseFloat(props.song.metadata['VIDEOGAP']?.replace(',', '.') || '0'))
const songTitle = computed(() => props.song.metadata['TITLE'] || 'Título Desconhecido')
const songArtist = computed(() => props.song.metadata['ARTIST'] || 'Artista Desconhecido')
const singerP1 = computed(() => props.song.metadata['DUETSINGERP1'])
const singerP2 = computed(() => props.song.metadata['DUETSINGERP2'])

// Initialize offset from song metadata if we want to support persistent offset in metadata later
// For now, globalOffset is an additional offset on top of GAP.
// If we saved offset in DB, we should load it. 
// But wait, the song object passed here is parsed from TXT.
// If we updated the song in DB, we updated the TXT content?
// No, `updateSong` updates the DB record. But `loadSavedSong` parses `txtContent`.
// If we want to persist offset, we should probably update `txtContent` in DB or store `offset` as a separate field in DB and apply it here.
// The user asked to "save changes".
// If I update `txtContent` in DB, then next time it loads, it will have the new GAP.
// Let's assume `globalOffset` modifies the GAP.

const handleIntervalUpdate = (active: boolean) => {
	if (active) {
		// Entering interval: Debounce 2s
		if (!isInterval.value && !intervalTimeout) {
			intervalTimeout = setTimeout(() => {
				isInterval.value = true
				intervalTimeout = null
			}, 2000)
		}
	} else {
		// Leaving interval: Immediate
		if (intervalTimeout) {
			clearTimeout(intervalTimeout)
			intervalTimeout = null
		}
		isInterval.value = false
	}
}

const restartSong = () => {
	seekTo(0)
	playing.value = true
	hasEnded.value = false
}

const saveSettings = async () => {
	if (!props.songId) {
		alert('Não é possível salvar configurações de uma música não salva.')
		return
	}

	try {
		// Save the offset difference to the database instead of modifying the file
		await updateSong(props.songId, { gapOffset: globalOffset.value })
		originalOffset.value = globalOffset.value
		alert('Configurações salvas! O ajuste de sincronia foi atualizado.')
		showSettings.value = false
	} catch (e) {
		console.error(e)
		alert('Falha ao salvar configurações')
	}
}

const resetSettings = () => {
	globalOffset.value = 0
	backgroundDim.value = 0.6
	lyricsScale.value = 1
}


// Pre-calculate active segments for each player to debounce activity
// If gaps between lines are small (< 5s), merge them into a single active segment
const getPlayerSegments = (playerNum: number) => {
	const segments: { start: number, end: number }[] = []
	let currentSegment: { start: number, end: number } | null = null
	const GAP_THRESHOLD = 5 // seconds

	for (const line of props.song.lines) {
		// If player is undefined, it's usually both. Let's assume undefined = both.
		const isForPlayer = line.player === playerNum || line.player === undefined

		if (!isForPlayer) continue
		if (!line.startTime || !line.endTime) continue

		if (!currentSegment) {
			currentSegment = { start: line.startTime, end: line.endTime }
		} else {
			if (line.startTime - currentSegment.end < GAP_THRESHOLD) {
				// Merge
				currentSegment.end = line.endTime
			} else {
				// Push and start new
				segments.push(currentSegment)
				currentSegment = { start: line.startTime, end: line.endTime }
			}
		}
	}
	if (currentSegment) segments.push(currentSegment)
	return segments
}

const p1Segments = computed(() => getPlayerSegments(1))
const p2Segments = computed(() => getPlayerSegments(2))

const activePlayers = computed(() => {
	// If we are in an instrumental interval, no one is "active" (names should be gray/inactive)
	if (isInterval.value) return new Set<number>()

	const time = currentTime.value + globalOffset.value
	const active = new Set<number>()

	// Check P1
	if (p1Segments.value.some(s => time >= s.start && time <= s.end)) {
		active.add(1)
	}
	// Check P2
	if (p2Segments.value.some(s => time >= s.start && time <= s.end)) {
		active.add(2)
	}
	return active
})

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

const isSongFinished = computed(() => {
	// Consider song finished if we are near the end of duration
	// OR if we are significantly past the last note (e.g. 10s) and user stopped playing?
	// Actually, user wants a specific screen when "song finishes". Usually means audio ends.
	if (hasEnded.value) return true
	return duration.value > 0 && currentTime.value >= duration.value - 0.5
})

const isLyricsFinished = computed(() => {
	return currentTime.value > (lastNoteTime.value + 2)
})

const introDuration = computed(() => {
	const start = firstNoteTime.value
	let targetDuration = 0

	if (start > 5) {
		targetDuration = start * 0.75
	} else {
		targetDuration = 5
	}

	// Clip to ensure lyrics have 1s prep time (lyrics start at start - 1)
	// So title must end at start - 1
	const lyricsStartTime = Math.max(0, start - 1)
	return Math.min(targetDuration, lyricsStartTime)
})

const showIntro = computed(() => {
	// Start hidden (when time is 0), show when playing starts
	if (currentTime.value <= 0.1) return false
	return currentTime.value < introDuration.value
})

const showHeaderTitle = computed(() => {
	// Show header title after intro is done
	return !showIntro.value
})

const shouldShowLyrics = computed(() => {
	if (isLyricsFinished.value) return false
	
	// Show 1s after intro ends, OR 1s before first note (whichever is earlier)
	const showTime = Math.min(introDuration.value + 1, Math.max(0, firstNoteTime.value - 1))
	
	return currentTime.value >= showTime
})

const isBackgroundClear = computed(() => {
	return showIntro.value || isInterval.value || isLyricsFinished.value
})

const backgroundVisualClass = computed(() => {
	return isBackgroundClear.value ? 'opacity-100 blur-none' : 'opacity-60 blur-md'
})

const currentBeat = computed(() => {
	const time = currentTime.value
	const gap = songGap.value / 1000
	const bpm = songBpm.value
	if (!bpm) return 0
	return ((time - gap) * bpm * 4) / 60
})

// --- HTML5 Audio Logic (Local) ---
const audioRef = ref<HTMLAudioElement>()
const videoRef = ref<HTMLVideoElement>()

// Only activate useMediaControls if NOT YouTube to save resources/avoid conflicts
const {
	playing: audioPlaying,
	currentTime: audioTime,
	duration: audioDuration,
	volume: audioVolume
} = useMediaControls(audioRef, {
	src: isYoutube.value ? undefined : props.audioSrc,
})

// --- YouTube Logic ---
let ytPlayer: any = null
const ytContainerId = 'youtube-player-container'
let timeUpdateInterval: any = null

const loadYoutubeAPI = () => {
	return new Promise<void>((resolve) => {
		if ((window as any).YT && (window as any).YT.Player) {
			resolve()
			return
		}
		const tag = document.createElement('script')
		tag.src = "https://www.youtube.com/iframe_api"
		const firstScriptTag = document.getElementsByTagName('script')[0]
		if (firstScriptTag && firstScriptTag.parentNode) {
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
		} else {
			document.head.appendChild(tag)
		}
		;(window as any).onYouTubeIframeAPIReady = () => resolve()
	})
}

const initYoutubePlayer = async () => {
	if (!props.youtubeId) return
	await loadYoutubeAPI()

	ytPlayer = new (window as any).YT.Player(ytContainerId, {
		videoId: props.youtubeId,
		playerVars: {
			autoplay: 1,
			controls: 0, // Hide YT controls
			disablekb: 1,
			fs: 0,
			iv_load_policy: 3, // Hide annotations
			modestbranding: 1,
			rel: 0,
			showinfo: 0,
			loop: 1, // Loop to prevent suggested videos at end
			playlist: props.youtubeId, // Required for loop to work
			origin: window.location.origin
		},
		events: {
			onReady: (event: any) => {
				duration.value = event.target.getDuration()
				event.target.setVolume(volume.value * 100)
				isReady.value = true
				playing.value = true // Auto-play on load
			},
			onStateChange: (event: any) => {
				// 1 = Playing, 2 = Paused
				if (event.data === 1) {
					// If we are resuming from an "Ended" state without explicit restart (e.g. auto-loop), pause it.
					if (hasEnded.value) {
						event.target.pauseVideo()
						playing.value = false
						return
					}
					playing.value = true
					hasEnded.value = false
				}
				if (event.data === 2) playing.value = false
				if (event.data === 0) {
					playing.value = false
					hasEnded.value = true
				}
			}
		}
	})

	// Manual loop to update time (YT doesn't have frequent 'timeupdate' event)
	timeUpdateInterval = setInterval(() => {
		if (ytPlayer && ytPlayer.getCurrentTime) {
			const time = ytPlayer.getCurrentTime()
			if (time !== undefined) {
				// Detect loop (time jump from near end to near start)
				if (duration.value > 0 && currentTime.value > duration.value - 1 && time < 1) {
					hasEnded.value = true
					playing.value = false
					ytPlayer.pauseVideo()
				}
				currentTime.value = time
			}
		}
	}, 100)
}

// --- Sync and Watchers ---

// 1. Initialization
onMounted(() => {
	if (isYoutube.value) {
		initYoutubePlayer()
	} else {
		// Local Mode: Sync useMediaControls refs with our manual refs
		watch(audioPlaying, (v) => playing.value = v)
		watch(audioTime, (v) => currentTime.value = v)
		watch(audioDuration, (v) => {
			duration.value = v
			if (v > 0) isReady.value = true
		}, { immediate: true })
		watch(audioVolume, (v) => volume.value = v)
		
		// Listen for ended event on audio element
		if (audioRef.value) {
			audioRef.value.addEventListener('ended', () => {
				hasEnded.value = true
				playing.value = false
			})
		}

		// Auto-start local video
		playing.value = true
	}
})

onUnmounted(() => {
	if (timeUpdateInterval) clearInterval(timeUpdateInterval)
	if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy()
})

// 2. Play/Pause Control (Bidirectional)
watch(playing, (shouldPlay) => {
	if (isYoutube.value) {
		if (ytPlayer && ytPlayer.playVideo) {
			shouldPlay ? ytPlayer.playVideo() : ytPlayer.pauseVideo()
		}
	} else {
		audioPlaying.value = shouldPlay
	}
})

// 3. Volume Control
watch(volume, (vol) => {
	if (isYoutube.value) {
		if (ytPlayer && ytPlayer.setVolume) {
			ytPlayer.setVolume(vol * 100)
		}
	} else {
		audioVolume.value = vol
	}
})

// 4. Seek Control (One-way: UI -> Player)
// We need a way to distinguish UI seek from regular update
// For simplicity, we'll use a setter in the template or a separate function
const seekTo = (time: number) => {
	currentTime.value = time
	if (isYoutube.value) {
		if (ytPlayer && ytPlayer.seekTo) {
			ytPlayer.seekTo(time, true)
		}
	} else {
		audioTime.value = time
	}
}

// Sync video with audio (Local only)
watch(playing, (isPlaying) => {
	if (!isYoutube.value && videoRef.value) {
		if (isPlaying) videoRef.value.play()
		else videoRef.value.pause()
	}
})

// Sync video time when seeking (Local only)
watch(currentTime, (time) => {
	if (!isYoutube.value && videoRef.value) {
		const targetTime = Math.max(0, time - videoGap.value)
		if (Math.abs(videoRef.value.currentTime - targetTime) > 0.5) {
			videoRef.value.currentTime = targetTime
		}
	}
})

const formatTime = (seconds: number) => {
	if (!seconds || isNaN(seconds)) return '0:00'
	const m = Math.floor(seconds / 60)
	const s = Math.floor(seconds % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
	<div class="fixed inset-0 w-full h-full overflow-hidden bg-black" :class="{ 'cursor-none': isIdle && playing }">
		<!-- Loading Overlay (Non-blocking for controls) -->
		<div v-if="!isReady" class="absolute inset-0 z-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div class="flex flex-col items-center gap-4">
				<div class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
				<p class="text-white font-bold drop-shadow-md">Carregando Player...</p>
			</div>
		</div>

		<!-- Background -->
		<div class="absolute inset-0 z-0 transition-all duration-1000 ease-in-out" :class="{ 'scale-105': isInterval }">
			<!-- YouTube Player (Acts as Background & Audio) -->
			<div v-if="isYoutube" :class="twMerge('w-full h-full pointer-events-none transition-all duration-1000', backgroundVisualClass)">
				<div :id="ytContainerId" class="w-full h-full"></div>
			</div>

			<!-- Local Video/Image Background -->
			<template v-else>
				<video v-if="isVideoBackground && backgroundSrc" ref="videoRef" :src="backgroundSrc" loop muted
					:class="twMerge('w-full h-full object-cover transition-all duration-1000', backgroundVisualClass)" />
				<img v-else-if="backgroundSrc" :src="backgroundSrc"
					:class="twMerge('w-full h-full object-cover transition-all duration-1000', backgroundVisualClass)"
					alt="Background" />
				<div v-else class="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
			</template>

			<!-- Overlay for better text readability -->
			<div class="absolute inset-0 bg-black transition-opacity duration-1000" 
				:style="{ opacity: isBackgroundClear ? 0 : backgroundDim }" />
		</div>

		<!-- Intro Overlay (MTV Style) -->
		<div class="absolute bottom-32 left-8 z-40 transition-all duration-1000 ease-out transform"
			:class="showIntro ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'">
			<div class="bg-gradient-to-r from-black/80 to-transparent p-6 rounded-l-lg border-l-4 border-violet-500">
				<h1 class="text-4xl font-black text-white tracking-tighter uppercase mb-1 drop-shadow-lg">{{ songTitle }}</h1>
				<h2 class="text-xl font-medium text-violet-300 tracking-wide uppercase drop-shadow-md">{{ songArtist }}</h2>
			</div>
		</div>

		<!-- Content -->
		<div class="relative z-10 h-full w-full">
			<!-- Lyrics Display (Full Screen) -->
			<div class="absolute inset-0 overflow-hidden flex items-center justify-center">
				<!-- Duet Singers Overlay -->
				<div v-if="singerP1" 
					class="absolute top-1/2 -translate-y-1/2 font-black text-6xl uppercase tracking-widest -rotate-90 origin-center pointer-events-none whitespace-nowrap z-10 transition-all duration-500 -translate-x-1/2"
					:class="[
						activePlayers.has(1) 
							? 'left-14 text-white scale-105 opacity-100 blur-none drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' 
							: 'left-8 text-white/20 scale-90 opacity-40 blur-sm'
					]">
					{{ singerP1 }}
				</div>
				<div v-if="singerP2" 
					class="absolute top-1/2 -translate-y-1/2 font-black text-6xl uppercase tracking-widest rotate-90 origin-center pointer-events-none whitespace-nowrap z-10 transition-all duration-500 translate-x-1/2"
					:class="[
						activePlayers.has(2) 
							? 'right-14 text-white scale-105 opacity-100 blur-none drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' 
							: 'right-8 text-white/20 scale-90 opacity-40 blur-sm'
					]">
					{{ singerP2 }}
				</div>

				<transition
					enter-active-class="transition-opacity duration-1000 ease-out"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-1000 ease-in"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<LyricsDisplay v-show="shouldShowLyrics" :lines="song.lines" :current-time="currentTime + globalOffset" :playing="playing"
						:lyrics-scale="lyricsScale"
						@interval="handleIntervalUpdate" class="z-0" />
				</transition>
			</div>

			<!-- Header -->
			<div class="absolute top-0 left-0 right-0 p-8 flex items-center justify-between z-50 pointer-events-none bg-gradient-to-b from-black/90 to-transparent h-32 transition-opacity duration-500"
				:class="{ 'opacity-0': isIdle && playing, 'opacity-100': !isIdle || !playing }">
				<div class="flex items-center gap-4 pointer-events-auto">
					<button @click="emit('back')"
						class="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all text-white">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
							class="w-6 h-6">
							<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
						</svg>
						<span class="sr-only">Back</span>
					</button>
					
					<!-- Header Title -->
					<div class="transition-all duration-1000 ease-out transform"
						:class="showHeaderTitle ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'">
						<h3 class="text-white font-bold text-lg leading-none drop-shadow-md">{{ songTitle }}</h3>
						<p class="text-white/60 text-xs font-medium uppercase tracking-wider drop-shadow-sm">{{ songArtist }}</p>
					</div>
				</div>
			</div>

			<!-- Settings Toggle -->
			<button @click="showSettings = !showSettings"
				class="absolute top-8 right-8 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full pointer-events-auto transition-all hover:rotate-90 shadow-lg border border-white/10">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.581-.495.644-.869l.214-1.281z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</button>

			<!-- Settings Panel -->
			<transition
				enter-active-class="transition ease-out duration-200"
				enter-from-class="opacity-0 translate-x-4"
				enter-to-class="opacity-100 translate-x-0"
				leave-active-class="transition ease-in duration-150"
				leave-from-class="opacity-100 translate-x-0"
				leave-to-class="opacity-0 translate-x-4"
			>
				<div v-if="showSettings"
					class="absolute top-24 right-8 z-50 bg-zinc-900/95 backdrop-blur-xl p-6 rounded-2xl text-white w-80 border border-white/10 pointer-events-auto shadow-2xl flex flex-col gap-6">
					
					<div class="flex items-center justify-between border-b border-white/10 pb-4">
						<h3 class="font-bold text-lg flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-violet-400">
								<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
							</svg>
							Configurações
						</h3>
						<button @click="showSettings = false" class="text-white/40 hover:text-white transition-colors">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Info Section -->
					<div class="space-y-2 text-xs font-mono bg-black/30 p-3 rounded-lg border border-white/5">
						<div class="flex justify-between">
							<span class="text-gray-400">BPM:</span>
							<span>{{ songBpm }}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">GAP:</span>
							<span>{{ songGap }}ms</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">GAP Vídeo:</span>
							<span>{{ videoGap }}s</span>
						</div>
					</div>

					<!-- Visual Settings -->
					<div class="space-y-3 border-t border-white/10 pt-3">
						<div class="flex justify-between items-center">
							<span class="text-sm font-medium text-gray-300">Escurecer Fundo</span>
							<span class="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
								{{ Math.round(backgroundDim * 100) }}%
							</span>
						</div>
						<input type="range" min="0" max="1" step="0.05" v-model="backgroundDim" class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
						
						<div class="flex justify-between items-center mt-2">
							<span class="text-sm font-medium text-gray-300">Tamanho da Letra</span>
							<span class="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
								{{ Number(lyricsScale).toFixed(1) }}x
							</span>
						</div>
						<input type="range" min="0.5" max="2" step="0.1" v-model.number="lyricsScale" class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
					</div>

					<!-- Offset Control -->
					<div class="space-y-3">
						<div class="flex justify-between items-center">
							<span class="text-sm font-medium text-gray-300">Sincronia Áudio/Letra</span>
							<span class="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
								{{ globalOffset > 0 ? '+' : '' }}{{ globalOffset.toFixed(2) }}s
							</span>
						</div>
						
						<div class="grid grid-cols-4 gap-2">
							<button @click="globalOffset -= 0.5" class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5" title="-0.5s">&lt;&lt;</button>
							<button @click="globalOffset -= 0.1" class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5" title="-0.1s">&lt;</button>
							<button @click="globalOffset += 0.1" class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5" title="+0.1s">&gt;</button>
							<button @click="globalOffset += 0.5" class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5" title="+0.5s">&gt;&gt;</button>
						</div>
					</div>

					<!-- Actions -->
					<div class="grid grid-cols-2 gap-3 pt-2">
						<button @click="resetSettings" 
							class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-bold transition-all border border-white/5">
							Resetar
						</button>
						<button @click="saveSettings" 
							class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
								<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
							</svg>
							Salvar
						</button>
					</div>
				</div>
			</transition>



			<!-- Controls (Simple for MVP) -->
			<div class="absolute bottom-0 left-0 right-0 w-full flex flex-col items-center gap-4 px-8 pb-8 z-50 bg-gradient-to-t from-black/90 to-transparent pt-20 transition-opacity duration-500"
				:class="{ 'opacity-0': isIdle && playing, 'opacity-100': !isIdle || !playing }">
				<!-- Progress Bar -->
				<div class="w-full max-w-3xl h-8 flex items-center cursor-pointer group" @click="(e) => {
					const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
					const pos = (e.clientX - rect.left) / rect.width
					seekTo(pos * duration)
				}">
					<div class="w-full h-1 bg-white/20 rounded-full overflow-hidden relative group-hover:h-2 transition-all">
						<div class="absolute top-0 left-0 h-full bg-white transition-all duration-100 ease-linear"
							:style="{ width: `${(currentTime / duration) * 100}%` }" />
					</div>
				</div>

				<div class="flex items-center justify-between w-full max-w-3xl">
					<!-- Time Display -->
					<div class="text-xs font-mono text-white/60 w-20">
						{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
					</div>

					<!-- Play Controls -->
					<div class="flex items-center gap-6">
						<!-- Rewind -->
						<button @click="seekTo(currentTime - (shiftPressed ? 15 : 5))"
							class="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all"
							:title="shiftPressed ? '-15s' : '-5s'">
							<div class="flex flex-col items-center">
								<svg v-if="shiftPressed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
									<path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.188 2.805-1.628V8.688c0-1.44-1.555-2.342-2.805-1.628L12 11.03v-2.34c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
								</svg>
								<svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
									<path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.188 2.805-1.628V8.688c0-1.44-1.555-2.342-2.805-1.628L12 11.03v-2.34c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
								</svg>
								<span class="text-[10px] font-bold -mt-1">{{ shiftPressed ? '15' : '5' }}</span>
							</div>
						</button>

						<!-- Play/Pause -->
						<button @click="playing = !playing" :disabled="!isReady"
							class="p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
							<!-- Pause Icon -->
							<svg v-if="playing" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
								class="w-8 h-8 text-white">
								<path fill-rule="evenodd"
									d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
									clip-rule="evenodd" />
							</svg>
							<!-- Play Icon -->
							<svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
								class="w-8 h-8 text-white">
								<path fill-rule="evenodd"
									d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
									clip-rule="evenodd" />
							</svg>
							<span class="sr-only">{{ playing ? 'Pause' : 'Play' }}</span>
						</button>

						<!-- Forward -->
						<button @click="seekTo(currentTime + (shiftPressed ? 15 : 5))"
							class="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all"
							:title="shiftPressed ? '+15s' : '+5s'">
							<div class="flex flex-col items-center">
								<svg v-if="shiftPressed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
									<path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.342 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.688v2.34L5.055 7.06z" />
								</svg>
								<svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
									<path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.342 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.688v2.34L5.055 7.06z" />
								</svg>
								<span class="text-[10px] font-bold -mt-1">{{ shiftPressed ? '15' : '5' }}</span>
							</div>
						</button>
					</div>

					<!-- Volume Control -->
					<div class="flex items-center gap-2 w-20 group relative">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-white/60">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
						</svg>
						<input type="range" min="0" max="1" step="0.01" v-model="volume" class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
					</div>
				</div>
			</div>
		</div>

		<!-- End Screen -->
		<div v-if="isSongFinished" class="absolute inset-0 z-50 flex items-center justify-center animate-fade-in backdrop-blur-xl bg-black/60">
			<div class="flex flex-col items-center gap-8 p-8 max-w-2xl w-full text-center">
				<div class="space-y-2">
					<h2 class="text-6xl font-black text-white tracking-tighter drop-shadow-2xl uppercase">Música Finalizada</h2>
					<p class="text-2xl text-violet-200 font-light tracking-widest uppercase">Ótima Performance</p>
				</div>
				
				<div class="flex gap-6 mt-8">
					<button @click="restartSong" class="group relative px-8 py-4 bg-white text-black font-black text-xl uppercase tracking-wider hover:bg-violet-400 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(167,139,250,0.5)]">
						<span class="relative z-10 flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
								<path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd" />
							</svg>
							Repetir
						</span>
					</button>
					
					<button @click="emit('back')" class="group px-8 py-4 border-2 border-white/30 text-white font-bold text-xl uppercase tracking-wider hover:bg-white/10 hover:border-white transition-all duration-300 hover:scale-105">
						<span class="flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
								<path fill-rule="evenodd" d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z" clip-rule="evenodd" />
							</svg>
							Voltar ao Menu
						</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Hidden Audio Element -->
		<audio ref="audioRef" class="hidden" />
	</div>
</template>

<style scoped>
/* Add any specific styles here */
</style>
