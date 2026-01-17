<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'calibrated', offset: number): void
}>()

const preferences = usePreferencesStore()

// Calibration notes - using common notes in the human vocal range
// These are MIDI note numbers
const calibrationNotes = [
	{ midi: 60, name: 'C4', freq: 261.63 },  // Middle C
	{ midi: 64, name: 'E4', freq: 329.63 },  // E above middle C
	{ midi: 67, name: 'G4', freq: 392.00 },  // G above middle C
]

const currentNoteIndex = ref(0)
const isRecording = ref(false)
const isPlaying = ref(false)
const recordedPitches = ref<number[][]>([[], [], []]) // Array of pitches for each note
const status = ref<'idle' | 'playing' | 'recording' | 'done'>('idle')
const countdown = ref(0)
const calculatedOffset = ref(0)

// Audio context and oscillator for playing reference tones
let audioContext: AudioContext | null = null
let oscillator: OscillatorNode | null = null
let gainNode: GainNode | null = null

// Pitch detection
let micAudioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let micSource: MediaStreamAudioSourceNode | null = null
let micGainNode: GainNode | null = null
let mediaStream: MediaStream | null = null
let animationId: number | null = null

// Minimum number of pitch samples needed for valid calibration
const MIN_SAMPLES_FOR_CALIBRATION = 5

const currentNote = computed(() => calibrationNotes[currentNoteIndex.value])

const progress = computed(() => {
	const completedNotes = recordedPitches.value.filter(arr => arr.length >= MIN_SAMPLES_FOR_CALIBRATION).length
	return (completedNotes / calibrationNotes.length) * 100
})

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const detectedNote = ref('-')
const detectedPitch = ref<number | null>(null)
const volume = ref(0)

const autoCorrelate = (buf: Float32Array, sampleRate: number) => {
	let SIZE = buf.length
	let rms = 0

	for (let i = 0; i < SIZE; i++) {
		const val = buf[i] || 0
		rms += val * val
	}
	rms = Math.sqrt(rms / SIZE)
	volume.value = rms

	if (rms < 0.01) return -1

	let r1 = 0, r2 = SIZE - 1
	const thres = 0.15
	for (let i = 0; i < SIZE / 2; i++)
		if (Math.abs(buf[i] || 0) < thres) { r1 = i; break; }
	for (let i = 1; i < SIZE / 2; i++)
		if (Math.abs(buf[SIZE - i] || 0) < thres) { r2 = SIZE - i; break; }

	buf = buf.slice(r1, r2)
	SIZE = buf.length
	
	if (SIZE < 2) return -1

	const c = new Array(SIZE).fill(0)
	for (let i = 0; i < SIZE; i++)
		for (let j = 0; j < SIZE - i; j++)
			c[i] = c[i] + (buf[j] || 0) * (buf[j + i] || 0)

	let d = 0; while (c[d] > c[d + 1]) d++
	let maxval = -1, maxpos = -1
	for (let i = d; i < SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i]
			maxpos = i
		}
	}
	
	if (maxpos < 1 || maxpos >= SIZE - 1) return -1
	
	let T0 = maxpos

	const x1 = c[T0 - 1] ?? 0, x2 = c[T0] ?? 0, x3 = c[T0 + 1] ?? 0
	const a = (x1 + x3 - 2 * x2) / 2
	const b = (x3 - x1) / 2
	if (a) T0 = T0 - b / (2 * a)

	return sampleRate / T0
}

const updatePitch = () => {
	if (!analyser || !micAudioContext) return
	
	const buf = new Float32Array(2048)
	analyser.getFloatTimeDomainData(buf)
	const freq = autoCorrelate(buf, micAudioContext.sampleRate)

	if (freq !== -1 && freq > 50 && freq < 2000) {
		const noteNum = 12 * (Math.log(freq / 440) / Math.log(2)) + 69
		detectedPitch.value = noteNum
		const roundedNote = Math.round(noteNum)
		detectedNote.value = noteStrings[((roundedNote % 12) + 12) % 12] || '-'
		
		// If recording, save the pitch
		if (isRecording.value && currentNoteIndex.value < calibrationNotes.length) {
			recordedPitches.value[currentNoteIndex.value].push(noteNum)
		}
	} else {
		detectedPitch.value = null
		detectedNote.value = '-'
	}

	animationId = requestAnimationFrame(updatePitch)
}

const startMicrophoneDetection = async () => {
	try {
		micAudioContext = new window.AudioContext()
		
		const constraints: MediaStreamConstraints = {
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
				deviceId: preferences.inputDeviceId !== 'default' ? { exact: preferences.inputDeviceId } : undefined
			}
		}

		mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
		micSource = micAudioContext.createMediaStreamSource(mediaStream)
		
		micGainNode = micAudioContext.createGain()
		micGainNode.gain.value = preferences.inputGain

		analyser = micAudioContext.createAnalyser()
		analyser.fftSize = 2048
		
		micSource.connect(micGainNode)
		micGainNode.connect(analyser)
		
		updatePitch()
	} catch (e) {
		console.error('Error accessing microphone for calibration', e)
	}
}

const stopMicrophoneDetection = () => {
	if (animationId) cancelAnimationFrame(animationId)
	if (micSource) micSource.disconnect()
	if (micGainNode) micGainNode.disconnect()
	if (analyser) analyser.disconnect()
	if (mediaStream) mediaStream.getTracks().forEach(t => t.stop())
	if (micAudioContext) micAudioContext.close()
	
	micSource = null
	micGainNode = null
	analyser = null
	mediaStream = null
	micAudioContext = null
	animationId = null
}

const playReferenceNote = () => {
	if (!currentNote.value) return
	
	if (!audioContext) {
		audioContext = new window.AudioContext()
	}
	
	// Stop any existing oscillator
	if (oscillator) {
		oscillator.stop()
		oscillator.disconnect()
	}
	
	oscillator = audioContext.createOscillator()
	gainNode = audioContext.createGain()
	
	oscillator.type = 'sine'
	oscillator.frequency.value = currentNote.value.freq
	
	gainNode.gain.value = 0.3
	
	oscillator.connect(gainNode)
	gainNode.connect(audioContext.destination)
	
	oscillator.start()
	isPlaying.value = true
	
	// Stop after 2 seconds
	setTimeout(() => {
		if (oscillator) {
			oscillator.stop()
			oscillator.disconnect()
			oscillator = null
		}
		isPlaying.value = false
	}, 2000)
}

const stopReferenceNote = () => {
	if (oscillator) {
		oscillator.stop()
		oscillator.disconnect()
		oscillator = null
	}
	isPlaying.value = false
}

const startCalibrationForNote = async () => {
	status.value = 'playing'
	
	// Play reference note first
	playReferenceNote()
	
	// Wait for 2 seconds (while note plays)
	await new Promise(resolve => setTimeout(resolve, 2000))
	
	// Start recording
	status.value = 'recording'
	isRecording.value = true
	
	// Countdown for 3 seconds of recording
	countdown.value = 3
	const countdownInterval = setInterval(() => {
		countdown.value--
		if (countdown.value <= 0) {
			clearInterval(countdownInterval)
		}
	}, 1000)
	
	// Record for 3 seconds
	await new Promise(resolve => setTimeout(resolve, 3000))
	
	isRecording.value = false
	
	// Check if we got enough samples
	if (recordedPitches.value[currentNoteIndex.value].length < MIN_SAMPLES_FOR_CALIBRATION) {
		// Not enough samples, try again
		status.value = 'idle'
		recordedPitches.value[currentNoteIndex.value] = []
		return
	}
	
	// Move to next note or finish
	if (currentNoteIndex.value < calibrationNotes.length - 1) {
		currentNoteIndex.value++
		status.value = 'idle'
	} else {
		finishCalibration()
	}
}

const finishCalibration = () => {
	status.value = 'done'
	
	// Calculate the average offset for each note
	const offsets: number[] = []
	
	for (let i = 0; i < calibrationNotes.length; i++) {
		const pitches = recordedPitches.value[i]
		if (pitches.length > 0) {
			// Use median to avoid outliers
			const sorted = [...pitches].sort((a, b) => a - b)
			const median = sorted[Math.floor(sorted.length / 2)]
			
			// Calculate offset: target - detected
			// If user sings flat (lower), detected < target, offset is positive
			// We need to ADD the offset to the detected pitch to match the target
			const targetMidi = calibrationNotes[i].midi
			const offset = targetMidi - median
			offsets.push(offset)
		}
	}
	
	// Average offset across all notes
	if (offsets.length > 0) {
		const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length
		calculatedOffset.value = Math.round(avgOffset * 100) / 100 // Round to 2 decimal places
	}
}

const applyCalibration = () => {
	preferences.pitchCalibrationOffset = calculatedOffset.value
	emit('calibrated', calculatedOffset.value)
	emit('close')
}

const resetCalibration = () => {
	currentNoteIndex.value = 0
	recordedPitches.value = [[], [], []]
	status.value = 'idle'
	calculatedOffset.value = 0
}

const skipCalibration = () => {
	emit('close')
}

onMounted(() => {
	startMicrophoneDetection()
})

onUnmounted(() => {
	stopMicrophoneDetection()
	stopReferenceNote()
	if (audioContext) {
		audioContext.close()
	}
})
</script>

<template>
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl">
		<div class="flex flex-col items-center gap-6 p-8 max-w-2xl w-full text-center relative">
			
			<!-- Close Button -->
			<button @click="skipCalibration"
				class="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors">
				<Icon name="material-symbols:close-rounded" class="w-6 h-6" />
			</button>
			
			<!-- Title -->
			<div class="space-y-2 mb-4">
				<h2 class="text-3xl font-black text-white uppercase tracking-wider">
					<Icon name="material-symbols:tune-rounded" class="inline w-8 h-8 mr-2 -mt-1" />
					Calibração de Voz
				</h2>
				<p class="text-white/60 text-sm">
					Cante as notas para calibrar a detecção de pitch
				</p>
			</div>
			
			<!-- Progress Bar -->
			<div class="w-full max-w-md">
				<div class="h-2 bg-white/10 rounded-full overflow-hidden">
					<div class="h-full bg-violet-500 transition-all duration-500" :style="{ width: `${progress}%` }"></div>
				</div>
				<p class="text-white/40 text-xs mt-2">
					Nota {{ currentNoteIndex + 1 }} de {{ calibrationNotes.length }}
				</p>
			</div>
			
			<!-- Main Content -->
			<div v-if="status !== 'done'" class="bg-white/5 p-8 rounded-2xl border border-white/10 w-full max-w-md">
				<!-- Current Note Display -->
				<div class="mb-6">
					<div class="text-6xl font-black text-white mb-2">
						{{ currentNote?.name }}
					</div>
					<div class="text-white/40 text-sm">
						{{ currentNote?.freq.toFixed(2) }} Hz
					</div>
				</div>
				
				<!-- Status Messages -->
				<div class="h-16 flex items-center justify-center mb-6">
					<div v-if="status === 'idle'" class="text-white/60">
						Clique no botão abaixo para começar
					</div>
					<div v-else-if="status === 'playing'" class="text-yellow-400 animate-pulse flex items-center gap-2">
						<Icon name="material-symbols:volume-up-rounded" class="w-6 h-6" />
						Escute a nota de referência...
					</div>
					<div v-else-if="status === 'recording'" class="text-red-400 flex flex-col items-center gap-2">
						<div class="flex items-center gap-2">
							<span class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
							Gravando... Cante a nota!
						</div>
						<div class="text-4xl font-bold text-white">{{ countdown }}</div>
					</div>
				</div>
				
				<!-- Detected Pitch Display -->
				<div class="mb-6 p-4 bg-black/30 rounded-xl">
					<div class="text-xs text-white/40 uppercase tracking-wider mb-2">Sua nota detectada</div>
					<div class="text-4xl font-bold" :class="detectedNote !== '-' ? 'text-violet-400' : 'text-white/20'">
						{{ detectedNote }}
					</div>
					<div v-if="detectedPitch !== null" class="text-white/40 text-xs mt-1">
						MIDI: {{ detectedPitch.toFixed(2) }}
					</div>
					
					<!-- Volume Meter -->
					<div class="mt-3 h-2 bg-black/40 rounded-full overflow-hidden">
						<div class="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 transition-all duration-100"
							:style="{ width: `${Math.min(100, volume * 500)}%` }">
						</div>
					</div>
				</div>
				
				<!-- Action Button -->
				<div v-if="status === 'idle'" class="flex gap-3">
					<button @click="playReferenceNote"
						class="flex-1 px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-lg uppercase tracking-wider rounded-xl transition-all hover:scale-105 border border-white/10"
						:disabled="isPlaying">
						<Icon :name="isPlaying ? 'material-symbols:volume-up-rounded' : 'material-symbols:play-circle-rounded'" class="inline w-6 h-6 mr-2 -mt-0.5" :class="{ 'animate-pulse': isPlaying }" />
						{{ isPlaying ? 'Ouvindo...' : 'Ouvir Nota' }}
					</button>
					<button @click="startCalibrationForNote"
						class="flex-1 px-6 py-4 bg-violet-500 hover:bg-violet-400 text-white font-bold text-lg uppercase tracking-wider rounded-xl transition-all hover:scale-105">
						<Icon name="material-symbols:mic-rounded" class="inline w-6 h-6 mr-2 -mt-0.5" />
						Gravar
					</button>
				</div>
				
				<button v-else-if="status === 'playing'" disabled
					class="w-full px-6 py-4 bg-yellow-500/50 text-white font-bold text-lg uppercase tracking-wider rounded-xl cursor-not-allowed">
					<Icon name="material-symbols:volume-up-rounded" class="inline w-6 h-6 mr-2 -mt-0.5 animate-pulse" />
					Ouvindo nota...
				</button>
				
				<button v-else-if="status === 'recording'" disabled
					class="w-full px-6 py-4 bg-red-500/50 text-white font-bold text-lg uppercase tracking-wider rounded-xl cursor-not-allowed">
					<Icon name="material-symbols:mic-rounded" class="inline w-6 h-6 mr-2 -mt-0.5 animate-pulse" />
					Gravando...
				</button>
			</div>
			
			<!-- Results -->
			<div v-else class="bg-white/5 p-8 rounded-2xl border border-white/10 w-full max-w-md">
				<div class="text-green-400 mb-4">
					<Icon name="material-symbols:check-circle-rounded" class="w-16 h-16 mx-auto" />
				</div>
				<h3 class="text-2xl font-bold text-white mb-4">Calibração Completa!</h3>
				
				<div class="bg-black/30 p-4 rounded-xl mb-6">
					<div class="text-xs text-white/40 uppercase tracking-wider mb-2">Ajuste calculado</div>
					<div class="text-3xl font-bold text-violet-400">
						{{ calculatedOffset >= 0 ? '+' : '' }}{{ calculatedOffset.toFixed(2) }} semitons
					</div>
					<p class="text-white/40 text-xs mt-2">
						{{ calculatedOffset >= 0 
							? 'Sua voz é detectada um pouco abaixo do real' 
							: 'Sua voz é detectada um pouco acima do real' }}
					</p>
				</div>
				
				<div class="flex gap-3">
					<button @click="resetCalibration"
						class="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-wider rounded-xl transition-all">
						Refazer
					</button>
					<button @click="applyCalibration"
						class="flex-1 px-4 py-3 bg-violet-500 hover:bg-violet-400 text-white font-bold uppercase tracking-wider rounded-xl transition-all">
						Aplicar
					</button>
				</div>
			</div>
			
			<!-- Skip Link -->
			<button @click="skipCalibration"
				class="text-white/40 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors py-2">
				Pular Calibração
			</button>
		</div>
	</div>
</template>
