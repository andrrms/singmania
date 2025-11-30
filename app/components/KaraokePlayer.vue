<script setup lang="ts">
import { useKeyModifier, useIdle } from '@vueuse/core'
import { ref, watch, computed, onMounted } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { UltraStarSong } from '../utils/ultrastarParser'
import { updateSong } from '../utils/db'
import { usePitchDetector } from '../composables/usePitchDetector'
import { useScoring } from '../composables/useScoring'
import { useKaraokePlayer } from '../composables/useKaraokePlayer'
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

// --- Player Logic (Composable) ---
const {
	playing,
	currentTime,
	duration,
	isReady,
	hasEnded,
	volume,
	globalOffset,
	backgroundDim,
	lyricsScale,
	songTitle,
	songArtist,
	videoGap,
	firstNoteTime,
	lastNoteTime,
	introDuration,
	showIntro,
	isLyricsFinished,
	isSongFinished,
	isInterval,
	seekTo,
	restartSong,
	handlePlayerReady,
	handlePlayerEnded,
	handleIntervalUpdate
} = useKaraokePlayer(props)

// --- Local State ---
const isYoutube = computed(() => !!props.youtubeId)
const micPermission = ref<PermissionState | 'unknown'>('unknown')
const selectedDifficulty = ref('Fácil')
const difficulties = ['Fácil', 'Difícil', 'SingStar!', 'Freestyle']
const selectedPlayer = ref<number | undefined>(undefined)
const showSettings = ref(false)
const preferences = usePreferencesStore()
const showPitchVisualizer = ref(false)
const originalOffset = ref(props.gapOffset || 0) // To track changes for saving
const hasStarted = ref(false)

const shiftPressed = useKeyModifier('Shift')
const { idle: isIdle } = useIdle(3000)

// --- Computed Helpers ---
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

// --- Settings Actions ---
const saveSettings = async () => {
	if (!props.songId) {
		alert('Não é possível salvar configurações de uma música não salva.')
		return
	}

	try {
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

const handleRestart = () => {
	restartSong()
	resetScore()
}

// --- Player Refs ---
const youtubePlayerRef = ref<InstanceType<typeof YoutubePlayer> | null>(null)
const localPlayerRef = ref<InstanceType<typeof LocalPlayer> | null>(null)

// Sync seek
watch(currentTime, (time) => {
	// Only seek if the difference is significant (e.g. user scrubbed)
	// But here we might be getting updates FROM the player.
	// We need a way to distinguish "update from player" vs "request to seek"
	// The composable has `seekTo` which updates `currentTime`.
	// The players emit `update:currentTime`.
	// If we bind `currentTime` to the players, we need to be careful not to create loops.
	// Actually, `YoutubePlayer` and `LocalPlayer` expose `seekTo`.
	// We should use that for seeking, and just listen to updates.
})

// Override the composable's seekTo to actually control the refs
const performSeek = (time: number) => {
	seekTo(time) // Update state
	if (isYoutube.value) {
		youtubePlayerRef.value?.seekTo(time)
	} else {
		localPlayerRef.value?.seekTo(time)
	}
}

// --- Mic & Start ---
onMounted(() => {
	checkMicPermission()
})

const checkMicPermission = async () => {
	try {
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
		stream.getTracks().forEach(track => track.stop())
		startPitch()
	} catch (e) {
		console.error('Mic permission denied', e)
		micPermission.value = 'denied'
	}
}

const startGame = () => {
	hasStarted.value = true
	playing.value = true
	if (micPermission.value === 'granted') {
		startPitch()
	}
}

// --- Visual Helpers ---
const showHeaderTitle = computed(() => !showIntro.value)
const isBackgroundClear = computed(() => showIntro.value || isInterval.value || isLyricsFinished.value)
const backgroundVisualClass = computed(() => isBackgroundClear.value ? 'opacity-100 blur-none' : 'opacity-60 blur-md')

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

const formatTime = (seconds: number) => {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
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
					@ready="handlePlayerReady" @ended="handlePlayerEnded" @update:current-time="currentTime = $event"
					@update:playing="playing = $event" />
			</div>

			<!-- Local Video/Image Background -->
			<div v-else
				:class="twMerge('w-full h-full transition-all duration-1000', backgroundVisualClass, isSongFinished ? 'opacity-0' : '')">
				<LocalPlayer ref="localPlayerRef" :audio-src="audioSrc!" :background-src="backgroundSrc"
					:is-video-background="isVideoBackground!" :playing="playing" :volume="volume" :video-gap="videoGap"
					@ready="handlePlayerReady" @ended="handlePlayerEnded" @update:current-time="currentTime = $event"
					@update:playing="playing = $event" />
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
					<LyricsDisplay v-show="!isLyricsFinished && currentTime >= 0" :lines="song.lines"
						:current-time="currentTime + globalOffset" :playing="playing" :lyrics-scale="lyricsScale"
						@interval="handleIntervalUpdate" class="z-0" />
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
				<ScoreDisplay :score="score" :total-max-score="totalMaxScore" :rating="rating" :last-feedback="lastFeedback"
					:golden-note-hit="goldenNoteHit" :singer-p1="singerP1" :singer-p2="singerP2"
					:selected-player="selectedPlayer" />
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
				<button v-if="showIntro && currentTime < firstNoteTime - 5" @click="performSeek(Math.max(0, firstNoteTime - 5))"
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
			:gold-total="totalGoldenNotes" @restart="handleRestart" @back="emit('back')" />
	</div>
</template>

<style scoped>
/* Add any specific styles here */
</style>
