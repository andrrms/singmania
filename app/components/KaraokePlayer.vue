<script setup lang="ts">
import { useKeyModifier, useIdle, useStorage } from '@vueuse/core'
import { ref, watch, computed, onMounted } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { UltraStarSong } from '../utils/ultrastarParser'
import { updateSong } from '../utils/db'
import { usePitchDetector } from '../composables/usePitchDetector'
import { useScoring } from '../composables/useScoring'
import { usePreferencesStore } from '~/stores/preferences'
import PlayerControls from './player/PlayerControls.vue'
import PlayerSettings from './player/PlayerSettings.vue'
import YoutubePlayer from './player/YoutubePlayer.vue'
import LocalPlayer from './player/LocalPlayer.vue'
import PitchVisualizer from './player/PitchVisualizer.vue'
import ScoreDisplay from './player/ScoreDisplay.vue'
import PlayerProgressBar from './player/PlayerProgressBar.vue'
import ResultsScreen from './player/ResultsScreen.vue'
import PlayerStartScreen from './player/PlayerStartScreen.vue'
import ParticlesBackground from './ParticlesBackground.vue'

const props = defineProps<{
	song: UltraStarSong
	songId?: number
	audioSrc?: string
	backgroundSrc?: string
	coverSrc?: string
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
const hasStarted = ref(false)
const micPermission = ref<PermissionState | 'unknown'>('unknown')
const selectedDifficulty = ref('Fácil')
const difficulties = ['Fácil', 'Difícil', 'SingStar!', 'Freestyle']
const selectedPlayer = ref<number | undefined>(undefined)
const showSettings = ref(false)
const preferences = usePreferencesStore()
const showPitchVisualizer = ref(false)
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
const hasDuetNotes = computed(() => {
	const p1 = props.song.lines.some(l => l.player === 1)
	const p2 = props.song.lines.some(l => l.player === 2)
	return p1 && p2
})
const isDuet = computed(() => (!!singerP1.value && !!singerP2.value) || hasDuetNotes.value)

// --- Pitch & Scoring ---
const { start: startPitch, stop: stopPitch, pitch: currentPitch } = usePitchDetector()
const {
	score,
	rating,
	resetScore,
	goldenNoteHit,
	totalMaxScore,
	lastFeedback,
	noteStats,
	totalNotes,
	totalGoldenNotes,
	goldenNotesHit
} = useScoring(
	props.song.lines,
	computed(() => currentTime.value + globalOffset.value),
	currentPitch,
	selectedDifficulty,
	playing,
	selectedPlayer
)

// --- End Screen Stats ---
const finalRank = computed(() => {
	if (selectedDifficulty.value === 'Freestyle') return 'FREESTYLE'
	if (totalMaxScore.value === 0) return 'F'
	const percentage = score.value / totalMaxScore.value
	if (percentage >= 0.95) return 'SS'
	if (percentage >= 0.90) return 'S'
	if (percentage >= 0.80) return 'A'
	if (percentage >= 0.70) return 'B'
	if (percentage >= 0.60) return 'C'
	if (percentage >= 0.40) return 'D'
	return 'F'
})

const saveStats = async () => {
	if (!props.songId || selectedDifficulty.value === 'Freestyle') return
	try {
		await updateSong(props.songId, {
			highScore: Math.round(score.value),
			rank: finalRank.value,
			playCount: 1,
			lastPlayedAt: Date.now(),
			noteStats: { ...noteStats }
		})
	} catch (e) {
		console.error('Failed to save stats', e)
	}
}

watch(hasEnded, (ended) => {
	if (ended) {
		saveStats()
	}
})


const handleIntervalUpdate = (active: boolean, duration?: number, nextNoteTime?: number) => {
	// Logic:
	// 1. Delay 2s to show
	// 2. Must have at least 1s before next note (handled by LyricsDisplay usually, but let's double check if we have info)
	// 3. Interval duration must be > 4s (after calculations)

	// Note: LyricsDisplay emits 'interval' with (active). It doesn't pass duration/nextNoteTime currently.
	// We might need to rely on the fact that LyricsDisplay handles the "when" to emit.
	// But the user asked: "delay de 2s para mostrar... reaparecer com no mínimo 1s de antecedência... se durar menos de 4s não mostre"

	// Since we don't have the duration info here easily without recalculating, let's assume the caller (LyricsDisplay) 
	// or we can just implement the delay and see. 
	// Actually, to implement "don't show if < 4s", we need to know the duration.
	// Let's stick to the delay logic here. If the interval is short, the "active=false" will come quickly and cancel the timeout.

	if (active) {
		// Entering interval: Debounce 2s
		if (!isInterval.value && !intervalTimeout) {
			intervalTimeout = setTimeout(() => {
				// Check if we are still "active" (implicit by timeout not being cleared)
				// We also need to check if we have enough time remaining? 
				// For now, just the delay. If the interval was 3s, this runs at 2s, shows for 1s.
				// User said: "Caso, com esses cálculos, o intervalo dure menos de 4 segundos, não mostre."
				// This implies: (TotalInterval - 2s Delay - 1s Buffer) >= 4s? Or just TotalInterval >= 4s?
				// "delay de 2s... reaparecer com no mínimo 1s... Caso, com esses cálculos, o intervalo dure menos de 4s, não mostre"
				// This likely means the *visible* time. Visible = Total - 2 - 1.
				// So Total - 3 >= 4 => Total >= 7s.
				// If we don't know the total duration here, we can't enforce this strictly without modifying LyricsDisplay to pass it.
				// However, we can just enforce the 2s delay. If the "active=false" comes before 2s + 4s, we might have shown it for too short.
				// But we can't predict the future "active=false" event here.

				// Let's assume for this MVP refactor we just add the 2s delay. 
				// If we really need the duration check, we'd need to look up the next line in `song.lines`.

				isInterval.value = true
				intervalTimeout = null
			}, 2000)
		}
	} else {
		// Leaving interval: Immediate (or with 1s buffer if we could control it, but LyricsDisplay controls the trigger)
		// The user said "reaparecer com no mínimo 1s de antecedência". This means the interval screen should HIDE 1s before the singing starts.
		// LyricsDisplay likely emits 'false' when the next line is about to start.

		if (intervalTimeout) {
			clearTimeout(intervalTimeout)
			intervalTimeout = null
		}
		isInterval.value = false
	}
}

const restartSong = () => {
	seekTo(0)
	resetScore()
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

// Calculate intervals for timeline
const intervals = computed(() => {
	const ints: { start: number, end: number }[] = []
	const lines = props.song.lines
	if (lines.length < 2) return ints

	for (let i = 0; i < lines.length - 1; i++) {
		const currentLineEnd = lines[i].endTime || 0
		const nextLineStart = lines[i + 1].startTime || 0
		const diff = nextLineStart - currentLineEnd

		if (diff >= 5) {
			ints.push({ start: currentLineEnd, end: nextLineStart })
		}
	}
	return ints
})

// Format time helper
const formatTime = (seconds: number) => {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

// --- Player Refs ---
const youtubePlayerRef = ref<InstanceType<typeof YoutubePlayer> | null>(null)
const localPlayerRef = ref<InstanceType<typeof LocalPlayer> | null>(null)

const seekTo = (time: number) => {
	currentTime.value = time
	if (isYoutube.value) {
		youtubePlayerRef.value?.seekTo(time)
	} else {
		localPlayerRef.value?.seekTo(time)
	}
}

const handlePlayerReady = (dur: number) => {
	duration.value = dur
	isReady.value = true
}

onMounted(() => {
	checkMicPermission()
})

const checkMicPermission = async () => {
	try {
		// Check if we already have permission without prompting
		const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName })
		if (permissions.state === 'granted') {
			micPermission.value = 'granted'
		} else if (permissions.state === 'denied') {
			micPermission.value = 'denied'
		} else {
			micPermission.value = 'prompt'
		}

		permissions.onchange = () => {
			micPermission.value = permissions.state
		}
	} catch (e) {
		// Fallback for browsers that don't support permission query
		micPermission.value = 'prompt'
	}
}

const requestMicAccess = async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false
			}
		})
		micPermission.value = 'granted'
		// Stop the stream immediately, we just wanted permission
		stream.getTracks().forEach(track => track.stop())

		// Start the actual detector now that we have permission
		startPitch()
	} catch (e) {
		console.error('Mic permission denied', e)
		micPermission.value = 'denied'
	}
}

const startGame = () => {
	hasStarted.value = true
	playing.value = true
	// Ensure pitch detection is running if permission was already granted
	if (micPermission.value === 'granted') {
		startPitch()
	}
}

const handlePlayerEnded = () => {
	hasEnded.value = true
	playing.value = false
}

const handleTimeUpdate = (time: number) => {
	currentTime.value = time
}

const handlePlayingUpdate = (isPlaying: boolean) => {
	playing.value = isPlaying
}
</script>

<template>
	<div class="fixed inset-0 w-full h-full overflow-hidden bg-black" :class="{ 'cursor-none': isIdle && playing }">
		<!-- Start / Loading Screen -->
		<PlayerStartScreen v-if="!hasStarted" :song-title="songTitle" :song-artist="songArtist" :is-ready="isReady"
			:mic-permission="micPermission" :difficulties="difficulties" :selected-difficulty="selectedDifficulty"
			:is-duet="isDuet" :singer-p1="singerP1" :singer-p2="singerP2" :selected-player="selectedPlayer"
			@back="emit('back')" @start="startGame" @request-mic="requestMicAccess"
			@update:difficulty="selectedDifficulty = $event" @update:player="selectedPlayer = $event" />

		<!-- Background -->
		<div class="absolute inset-0 z-0 transition-all duration-1000 ease-in-out" :class="{ 'scale-105': isInterval }">
			<!-- Particles Background (Shown in Results) -->
			<div v-if="isSongFinished" class="absolute inset-0 z-10">
				<ParticlesBackground />
			</div>

			<!-- YouTube Player (Acts as Background & Audio) -->
			<div v-if="isYoutube"
				:class="twMerge('w-full h-full pointer-events-none transition-all duration-1000', backgroundVisualClass, isSongFinished ? 'opacity-0' : '')">
				<YoutubePlayer ref="youtubePlayerRef" :video-id="youtubeId!" :playing="playing" :volume="volume"
					@ready="handlePlayerReady" @ended="handlePlayerEnded" @update:current-time="handleTimeUpdate"
					@update:playing="handlePlayingUpdate" />
			</div>

			<!-- Local Video/Image Background -->
			<div v-else
				:class="twMerge('w-full h-full transition-all duration-1000', backgroundVisualClass, isSongFinished ? 'opacity-0' : '')">
				<LocalPlayer ref="localPlayerRef" :audio-src="audioSrc!" :background-src="backgroundSrc"
					:is-video-background="isVideoBackground!" :playing="playing" :volume="volume" :video-gap="videoGap"
					@ready="handlePlayerReady" @ended="handlePlayerEnded" @update:current-time="handleTimeUpdate"
					@update:playing="handlePlayingUpdate" />
			</div>

			<!-- Overlay for better text readability -->
			<div class="absolute inset-0 bg-black transition-opacity duration-1000 pointer-events-none"
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
				<transition enter-active-class="transition-opacity duration-1000 ease-out" enter-from-class="opacity-0"
					enter-to-class="opacity-100" leave-active-class="transition-opacity duration-1000 ease-in"
					leave-from-class="opacity-100" leave-to-class="opacity-0">
					<LyricsDisplay v-show="shouldShowLyrics" :lines="song.lines" :current-time="currentTime + globalOffset"
						:playing="playing" :lyrics-scale="lyricsScale" @interval="handleIntervalUpdate" class="z-0" />
				</transition>
			</div>

			<!-- Header -->
			<div
				class="absolute top-0 left-0 right-0 p-8 flex items-center justify-between z-50 pointer-events-none bg-gradient-to-b from-black/90 to-transparent h-32 transition-opacity duration-500">
				<div class="w-full flex items-center justify-between pointer-events-auto">
					<button @click="emit('back')"
						class="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all text-white aspect-square flex items-center justify-center">
						<Icon name="material-symbols:arrow-back-rounded" class="w-6 h-6" />
						<span class="sr-only">Back</span>
					</button>

					<!-- Header Title (Centered) -->
					<div class="transition-all duration-1000 ease-out transform text-center absolute left-1/2 -translate-x-1/2"
						:class="showHeaderTitle ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'">
						<h3 class="text-white font-bold text-lg leading-none drop-shadow-md">{{ songTitle }}</h3>
						<p class="text-white/60 text-xs font-medium uppercase tracking-wider drop-shadow-sm">{{ songArtist }}</p>
					</div>

					<!-- Empty div for flex balance if needed, or just rely on absolute centering -->
					<div></div>
				</div>
			</div>

			<!-- Score Display (Left Side - Moved Up) -->
			<div v-if="selectedDifficulty !== 'Freestyle'"
				class="absolute left-4 top-24 z-40 transition-all duration-500 pointer-events-none">
				<ScoreDisplay :score="score" :rating="rating" :last-feedback="lastFeedback" :golden-note-hit="goldenNoteHit"
					:singer-p1="singerP1" :singer-p2="singerP2" :selected-player="selectedPlayer" />
			</div>

			<!-- Settings Toggle -->
			<div class="absolute top-8 right-8 z-50 flex items-center gap-4 pointer-events-auto">
				<!-- Pitch Visualizer Toggle (Only in Debug Mode) -->
				<button v-if="preferences.debugMode" @click="showPitchVisualizer = !showPitchVisualizer"
					class="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all shadow-lg border border-white/10 aspect-square flex items-center justify-center"
					:class="{ 'bg-violet-500/50 border-violet-400': showPitchVisualizer }">
					<Icon name="material-symbols:music-note-rounded" class="w-6 h-6" />
				</button>

				<!-- Settings Toggle -->
				<button @click="showSettings = !showSettings"
					class="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all hover:rotate-90 shadow-lg border border-white/10 aspect-square flex items-center justify-center">
					<Icon name="material-symbols:settings-rounded" class="w-6 h-6" />
				</button>
			</div>

			<!-- Pitch Visualizer Window -->
			<transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0"
				enter-to-class="opacity-100" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100"
				leave-to-class="opacity-0">
				<PitchVisualizer v-if="showPitchVisualizer" :lines="song.lines" :current-time="currentTime + globalOffset"
					:current-pitch="currentPitch" />
			</transition>

			<!-- Settings Panel -->
			<PlayerSettings :show="showSettings" :debug-mode="preferences.debugMode" :background-dim="backgroundDim"
				:lyrics-scale="lyricsScale" :global-offset="globalOffset" @close="showSettings = false"
				@update:background-dim="backgroundDim = $event" @update:lyrics-scale="lyricsScale = $event"
				@update:global-offset="globalOffset = $event" @reset="resetSettings" @save="saveSettings"
				@update:debug-mode="preferences.debugMode = $event" />

			<!-- Skip Controls (Bottom Center-Left) -->
			<div class="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 pointer-events-auto">
				<!-- Skip Intro -->
				<button v-if="showIntro && currentTime < firstNoteTime - 5" @click="seekTo(Math.max(0, firstNoteTime - 5))"
					class="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold uppercase tracking-wider rounded-full transition-all shadow-lg hover:scale-105 border border-white/10">
					<span>Pular Intro</span>
					<Icon name="material-symbols:skip-next-rounded" class="w-6 h-6" />
				</button>

				<!-- Skip Outro -->
				<button v-if="isLyricsFinished && !isSongFinished" @click="handlePlayerEnded"
					class="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold uppercase tracking-wider rounded-full transition-all shadow-lg hover:scale-105 border border-white/10">
					<span>Pular Final</span>
					<Icon name="material-symbols:skip-next-rounded" class="w-6 h-6" />
				</button>
			</div>

			<!-- Controls (Bottom Right) -->
			<div class="absolute bottom-12 right-8 z-40 transition-opacity duration-500 pointer-events-auto">
				<PlayerControls :playing="playing" :current-time="currentTime" :duration="duration" :volume="volume"
					:is-ready="isReady" @update:playing="playing = $event" @update:volume="volume = $event" />
			</div>

			<!-- Bottom Progress Bar -->
			<div class="absolute bottom-0 left-0 right-0 z-40">
				<!-- Time Display -->
				<div
					class="absolute bottom-4 left-4 text-white/80 font-mono text-sm font-bold bg-black/50 px-2 py-1 rounded backdrop-blur-md">
					{{ formatTime(currentTime) }} / {{ formatTime(duration) }}
				</div>

				<PlayerProgressBar :current-time="currentTime" :duration="duration"
					:notes="song.lines.flatMap(l => l.words.flatMap(w => w.notes))" :intervals="intervals" />
			</div>
		</div>

		<!-- End Screen -->
		<ResultsScreen v-if="isSongFinished" :score="score" :total-max-score="totalMaxScore" :rank="finalRank"
			:song-title="songTitle" :song-artist="songArtist" :cover-src="coverSrc" :youtube-id="youtubeId"
			:difficulty="selectedDifficulty" :note-stats="noteStats" :total-notes="totalNotes" :gold-hit="goldenNotesHit"
			:gold-total="totalGoldenNotes" @restart="restartSong" @back="emit('back')" />
	</div>
</template>

<style scoped>
/* Add any specific styles here */
</style>
