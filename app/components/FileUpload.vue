<script setup lang="ts">
import { ref } from 'vue'
import { parseUltraStar, type UltraStarSong } from '~/utils/ultrastarParser'

const emit = defineEmits<{
	(e: 'ready', data: { 
		song: UltraStarSong, 
		audioSrc?: string, 
		backgroundSrc?: string, 
		isVideoBackground: boolean, 
		youtubeId?: string,
		// Raw files for caching
		txtContent?: string
		audioFile?: File
		backgroundFile?: File
		coverFile?: Blob
	}): void
}>()

const txtFile = ref<File | null>(null)
const audioFile = ref<File | null>(null)
const backgroundFile = ref<File | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const youtubeId = ref<string | null>(null)

const extractVideoFrame = (videoFile: File): Promise<Blob | null> => {
	return new Promise((resolve) => {
		const video = document.createElement('video')
		video.preload = 'metadata'
		video.src = URL.createObjectURL(videoFile)
		video.muted = true
		video.currentTime = 5 // Capture at 5 seconds to avoid black intro

		video.onloadeddata = () => {
			if (video.duration < 5) video.currentTime = video.duration / 2
		}

		video.onseeked = () => {
			const canvas = document.createElement('canvas')
			// Limit size for thumbnail
			const MAX_WIDTH = 640
			const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
			canvas.width = video.videoWidth * scale
			canvas.height = video.videoHeight * scale
			
			const ctx = canvas.getContext('2d')
			if (ctx) {
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
				canvas.toBlob((blob) => {
					URL.revokeObjectURL(video.src)
					resolve(blob)
				}, 'image/jpeg', 0.7)
			} else {
				URL.revokeObjectURL(video.src)
				resolve(null)
			}
		}
		
		video.onerror = () => {
			URL.revokeObjectURL(video.src)
			resolve(null)
		}
	})
}

const handleTxtUpload = async (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files.length > 0) {
		txtFile.value = files[0]
		// Check for YouTube ID in metadata
		try {
			const text = await files[0].text()
			const song = parseUltraStar(text)
			const videoTag = song.metadata['VIDEO']
			if (videoTag && videoTag.includes('v=')) {
				const match = videoTag.match(/v=([^,]+)/)
				if (match) {
					youtubeId.value = match[1]
				}
			} else {
				youtubeId.value = null
			}
		} catch (e) {
			console.error('Error parsing file for YouTube ID', e)
		}
	}
}

const isAudioVideo = ref(false)
const useVideoAsBackground = ref(false)

const handleAudioUpload = (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files.length > 0) {
		audioFile.value = files[0]
		isAudioVideo.value = files[0].type.startsWith('video/')
		// Reset checkbox if new file is uploaded
		if (!isAudioVideo.value) {
			useVideoAsBackground.value = false
		}
	}
}

const handleBackgroundUpload = (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files.length > 0) backgroundFile.value = files[0]
}

const startKaraoke = async () => {
	if (!txtFile.value) {
		error.value = 'Por favor, envie um arquivo de letra (.txt).'
		return
	}

	if (!audioFile.value && !youtubeId.value) {
		error.value = 'Por favor, envie um arquivo de áudio ou use um arquivo com ID do YouTube.'
		return
	}

	loading.value = true
	error.value = null

	try {
		// Parse Text File
		const textContent = await txtFile.value.text()
		const song = parseUltraStar(textContent)

		let audioSrc: string | undefined
		let backgroundSrc: string | undefined
		let isVideoBackground = false
		let coverBlob: Blob | undefined = undefined

		if (audioFile.value) {
			// Create Object URLs
			audioSrc = URL.createObjectURL(audioFile.value)

			if (useVideoAsBackground.value && audioFile.value) {
				backgroundSrc = audioSrc
				isVideoBackground = true
				// Extract frame from audio file (which is video)
				const frame = await extractVideoFrame(audioFile.value)
				if (frame) coverBlob = frame
			} else if (backgroundFile.value) {
				backgroundSrc = URL.createObjectURL(backgroundFile.value)
				if (backgroundFile.value.type.startsWith('video/')) {
					isVideoBackground = true
					const frame = await extractVideoFrame(backgroundFile.value)
					if (frame) coverBlob = frame
				} else if (backgroundFile.value.type.startsWith('image/')) {
					coverBlob = backgroundFile.value
				}
			}
		}

		emit('ready', { 
			song, 
			audioSrc, 
			backgroundSrc, 
			isVideoBackground, 
			youtubeId: youtubeId.value || undefined,
			txtContent: textContent,
			audioFile: audioFile.value || undefined,
			backgroundFile: backgroundFile.value || undefined,
			coverFile: coverBlob
		})
	} catch (e) {
		console.error(e)
		error.value = 'Falha ao processar arquivos. Verifique o formato.'
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<div class="w-full">
		<div class="space-y-6">
			<!-- Lyrics File -->
			<div class="group">
				<label class="block text-sm font-bold text-white/80 mb-2 uppercase tracking-wider flex items-center gap-2">
					<ClientOnly>
						<Icon name="material-symbols:description-outline" class="text-violet-400" />
					</ClientOnly>
					Letra UltraStar (.txt)
				</label>
				<div class="relative">
					<input type="file" accept=".txt" @change="handleTxtUpload" class="block w-full text-sm text-gray-300
						file:mr-4 file:py-3 file:px-6
						file:rounded-xl file:border-0
						file:text-sm file:font-bold file:uppercase file:tracking-wide
						file:bg-white/10 file:text-white
						hover:file:bg-white/20
						file:transition-colors
						cursor-pointer
						bg-black/20 rounded-xl border border-white/10 focus:border-violet-500 transition-colors outline-none" />
				</div>
			</div>

			<!-- Audio File -->
			<div class="group">
				<label class="block text-sm font-bold text-white/80 mb-2 uppercase tracking-wider flex items-center gap-2">
					<ClientOnly>
						<Icon name="material-symbols:audio-file-outline" class="text-violet-400" />
					</ClientOnly>
					Arquivo de Áudio (MP3/M4A/Video)
				</label>
				<input type="file" accept="audio/*,video/*" @change="handleAudioUpload" class="block w-full text-sm text-gray-300
					file:mr-4 file:py-3 file:px-6
					file:rounded-xl file:border-0
					file:text-sm file:font-bold file:uppercase file:tracking-wide
					file:bg-white/10 file:text-white
					hover:file:bg-white/20
					file:transition-colors
					cursor-pointer
					bg-black/20 rounded-xl border border-white/10 focus:border-violet-500 transition-colors outline-none" />
			</div>

			<!-- Background File (Optional) -->
			<div class="group" :class="{ 'opacity-50 pointer-events-none': useVideoAsBackground }">
				<label class="block text-sm font-bold text-white/80 mb-2 uppercase tracking-wider flex items-center gap-2">
					<ClientOnly>
						<Icon name="material-symbols:image-outline" class="text-violet-400" />
					</ClientOnly>
					Fundo (Opcional)
				</label>
				<input type="file" accept="image/*,video/*" @change="handleBackgroundUpload" :disabled="useVideoAsBackground"
					class="block w-full text-sm text-gray-300
					file:mr-4 file:py-3 file:px-6
					file:rounded-xl file:border-0
					file:text-sm file:font-bold file:uppercase file:tracking-wide
					file:bg-white/10 file:text-white
					hover:file:bg-white/20
					file:transition-colors
					cursor-pointer
					bg-black/20 rounded-xl border border-white/10 focus:border-violet-500 transition-colors outline-none" />
			</div>

			<!-- Video Background Checkbox -->
			<div v-if="isAudioVideo" class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
				<input type="checkbox" id="useVideoBg" v-model="useVideoAsBackground"
					class="w-5 h-5 rounded border-gray-500 text-violet-600 focus:ring-violet-500 bg-transparent" />
				<label for="useVideoBg" class="text-sm text-white/80 select-none font-medium">
					Usar arquivo de áudio como vídeo de fundo
				</label>
			</div>

			<div v-if="error" class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center font-medium flex items-center justify-center gap-2">
				<ClientOnly>
					<Icon name="material-symbols:error-outline" />
				</ClientOnly>
				{{ error }}
			</div>

			<div class="flex flex-col gap-3 pt-4">
				<button @click="startKaraoke" :disabled="!youtubeId || !txtFile || loading"
					class="w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider shadow-lg hover:shadow-red-600/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 disabled:hover:translate-y-0 disabled:hover:shadow-none">
					<ClientOnly>
						<Icon name="material-symbols:youtube-activity" class="w-6 h-6" />
					</ClientOnly>
					{{ loading ? 'Carregando...' : 'Adicionar à Biblioteca (YouTube)' }}
				</button>

				<button @click="startKaraoke" :disabled="!txtFile || !audioFile || loading"
					class="w-full py-4 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold uppercase tracking-wider shadow-lg hover:shadow-violet-600/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 disabled:hover:translate-y-0 disabled:hover:shadow-none">
					<ClientOnly>
						<Icon name="material-symbols:library-add-rounded" class="w-6 h-6" />
					</ClientOnly>
					{{ loading ? 'Carregando...' : 'Adicionar à Biblioteca (Local)' }}
				</button>
			</div>
		</div>
	</div>
</template>
