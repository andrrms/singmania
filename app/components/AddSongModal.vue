<script setup lang="ts">
import { ref, computed } from 'vue'
import { parseUltraStar, type UltraStarSong } from '~/utils/ultrastarParser'

const props = defineProps<{
	isOpen: boolean
}>()

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'save', data: {
		song: UltraStarSong,
		audioSrc?: string,
		backgroundSrc?: string,
		isVideoBackground: boolean,
		youtubeId?: string,
		txtContent?: string,
		audioFile?: File,
		backgroundFile?: File,
		coverFile?: Blob
	}): void
}>()

const step = ref(1)
const txtFile = ref<File | null>(null)
const songData = ref<UltraStarSong | null>(null)
const youtubeId = ref<string | null>(null)
const audioFile = ref<File | null>(null)
const backgroundFile = ref<File | null>(null)
const isAudioVideo = ref(false)
const useVideoAsBackground = ref(false)
const error = ref<string | null>(null)
const loading = ref(false)

// Reset state when modal opens/closes
watch(() => props.isOpen, (newVal) => {
	if (newVal) {
		step.value = 1
		txtFile.value = null
		songData.value = null
		youtubeId.value = null
		audioFile.value = null
		backgroundFile.value = null
		error.value = null
		loading.value = false
	}
})

const handleTxtUpload = async (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files.length > 0) {
		loading.value = true
		error.value = null
		try {
			txtFile.value = files[0]
			const text = await files[0].text()
			songData.value = parseUltraStar(text)

			// Check for YouTube ID
			const videoTag = songData.value.metadata['VIDEO']
			if (videoTag && videoTag.includes('v=')) {
				const match = videoTag.match(/v=([^,]+)/)
				if (match) {
					youtubeId.value = match[1]
				}
			} else {
				youtubeId.value = null
			}

			step.value = 2
		} catch (e) {
			console.error(e)
			error.value = 'Erro ao ler arquivo. Verifique se é um arquivo UltraStar válido.'
		} finally {
			loading.value = false
		}
	}
}

const handleAudioUpload = (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files.length > 0) {
		audioFile.value = files[0]
		isAudioVideo.value = files[0].type.startsWith('video/')
		if (!isAudioVideo.value) {
			useVideoAsBackground.value = false
		}
	}
}

const handleBackgroundUpload = (e: Event) => {
	const files = (e.target as HTMLInputElement).files
	if (files && files.length > 0) backgroundFile.value = files[0]
}

const extractVideoFrame = (videoFile: File): Promise<Blob | null> => {
	return new Promise((resolve) => {
		const video = document.createElement('video')
		video.preload = 'metadata'
		video.src = URL.createObjectURL(videoFile)
		video.muted = true
		video.currentTime = 5

		video.onloadeddata = () => {
			if (video.duration < 5) video.currentTime = video.duration / 2
		}

		video.onseeked = () => {
			const canvas = document.createElement('canvas')
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

const finish = async (useYoutube: boolean) => {
	if (!songData.value || !txtFile.value) return

	loading.value = true
	try {
		const textContent = await txtFile.value.text()

		let audioSrc: string | undefined
		let backgroundSrc: string | undefined
		let isVideoBackground = false
		let coverBlob: Blob | undefined = undefined

		if (!useYoutube && audioFile.value) {
			audioSrc = URL.createObjectURL(audioFile.value)

			if (useVideoAsBackground.value && audioFile.value) {
				backgroundSrc = audioSrc
				isVideoBackground = true
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

		emit('save', {
			song: songData.value,
			audioSrc,
			backgroundSrc,
			isVideoBackground,
			youtubeId: useYoutube ? youtubeId.value || undefined : undefined,
			txtContent: textContent,
			audioFile: audioFile.value || undefined,
			backgroundFile: backgroundFile.value || undefined,
			coverFile: coverBlob
		})

		emit('close')
	} catch (e) {
		console.error(e)
		error.value = 'Erro ao processar arquivos.'
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="$emit('close')"></div>

		<!-- Modal -->
		<div
			class="relative w-full max-w-2xl bg-[#1a1b26] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

			<!-- Header -->
			<div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
				<h2 class="text-xl font-bold text-white flex items-center gap-2">
					<ClientOnly>
						<Icon name="material-symbols:add-circle-rounded" class="text-violet-400 w-6 h-6" />
					</ClientOnly>
					Adicionar Música
				</h2>
				<button @click="$emit('close')" class="text-white/40 hover:text-white transition-colors">
					<ClientOnly>
						<Icon name="material-symbols:close-rounded" class="w-6 h-6" />
					</ClientOnly>
				</button>
			</div>

			<!-- Content -->
			<div class="p-8 overflow-y-auto custom-scrollbar">

				<!-- Step 1: Upload TXT -->
				<div v-if="step === 1" class="space-y-6">
					<div class="text-center space-y-2">
						<div class="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
							<ClientOnly>
								<Icon name="material-symbols:upload-file-rounded" class="w-8 h-8 text-violet-400" />
							</ClientOnly>
						</div>
						<h3 class="text-lg font-bold text-white">Carregue o arquivo da música</h3>
						<p class="text-white/60 text-sm">Selecione o arquivo .txt do UltraStar</p>
					</div>

					<div class="relative group">
						<input type="file" accept=".txt" @change="handleTxtUpload"
							class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
						<div
							class="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center group-hover:border-violet-500/50 group-hover:bg-violet-500/5 transition-all">
							<span class="text-violet-400 font-medium group-hover:text-violet-300">Clique para selecionar</span>
							<span class="text-white/40 mx-2">ou</span>
							<span class="text-white/40">arraste o arquivo</span>
						</div>
					</div>
				</div>

				<!-- Step 2: Options (YouTube found) -->
				<div v-else-if="step === 2 && youtubeId" class="space-y-6">
					<div class="text-center space-y-2 mb-8">
						<h3 class="text-lg font-bold text-white">Música Detectada!</h3>
						<p class="text-white/60">{{ songData?.metadata.TITLE }} - {{ songData?.metadata.ARTIST }}</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Option A: Use YouTube -->
						<button @click="finish(true)"
							class="group relative p-6 rounded-2xl bg-red-600/10 border border-red-600/20 hover:bg-red-600 hover:border-red-600 transition-all text-left">
							<div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
								<ClientOnly>
									<Icon name="material-symbols:check-circle-rounded" class="w-6 h-6 text-white" />
								</ClientOnly>
							</div>
							<div
								class="mb-4 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-white/20">
								<ClientOnly>
									<Icon name="logos:youtube-icon" class="w-6 h-6" />
								</ClientOnly>
							</div>
							<h4 class="font-bold text-white mb-1">Usar YouTube</h4>
							<p class="text-sm text-white/60 group-hover:text-white/80">Rápido e fácil. Usa o vídeo oficial do YouTube.
							</p>
						</button>

						<!-- Option B: Customize -->
						<button @click="step = 3"
							class="group relative p-6 rounded-2xl bg-violet-600/10 border border-violet-600/20 hover:bg-violet-600 hover:border-violet-600 transition-all text-left">
							<div
								class="mb-4 w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center group-hover:bg-white/20">
								<ClientOnly>
									<Icon name="material-symbols:edit-document-rounded"
										class="w-6 h-6 text-violet-400 group-hover:text-white" />
								</ClientOnly>
							</div>
							<h4 class="font-bold text-white mb-1">Personalizar</h4>
							<p class="text-sm text-white/60 group-hover:text-white/80">Use seus próprios arquivos de áudio e vídeo.
							</p>
						</button>
					</div>
				</div>

				<!-- Step 3: Customization (No YouTube or opted out) -->
				<div v-else-if="step === 3 || (step === 2 && !youtubeId)" class="space-y-6">
					<div class="text-center space-y-2 mb-6">
						<h3 class="text-lg font-bold text-white">Personalizar Arquivos</h3>
						<p class="text-white/60">Adicione o áudio e fundo para sua música.</p>
					</div>

					<!-- Audio Input -->
					<div class="space-y-2">
						<label class="text-sm font-bold text-white/80 uppercase tracking-wider">Áudio</label>
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

					<!-- Background Input -->
					<div class="space-y-2" :class="{ 'opacity-50 pointer-events-none': useVideoAsBackground }">
						<label class="text-sm font-bold text-white/80 uppercase tracking-wider">Fundo (Opcional)</label>
						<input type="file" accept="image/*,video/*" @change="handleBackgroundUpload"
							:disabled="useVideoAsBackground" class="block w-full text-sm text-gray-300
              file:mr-4 file:py-3 file:px-6
              file:rounded-xl file:border-0
              file:text-sm file:font-bold file:uppercase file:tracking-wide
              file:bg-white/10 file:text-white
              hover:file:bg-white/20
              file:transition-colors
              cursor-pointer
              bg-black/20 rounded-xl border border-white/10 focus:border-violet-500 transition-colors outline-none" />
					</div>

					<!-- Checkbox -->
					<div v-if="isAudioVideo" class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
						<input type="checkbox" id="useVideoBg" v-model="useVideoAsBackground"
							class="w-5 h-5 rounded border-gray-500 text-violet-600 focus:ring-violet-500 bg-transparent" />
						<label for="useVideoBg" class="text-sm text-white/80 select-none font-medium">
							Usar arquivo de áudio como vídeo de fundo
						</label>
					</div>

					<!-- Actions -->
					<div class="pt-4 flex gap-3">
						<button v-if="youtubeId" @click="step = 2"
							class="flex-1 py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all">
							Voltar
						</button>
						<button @click="finish(false)" :disabled="!audioFile || loading"
							class="flex-1 py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg hover:shadow-violet-600/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
							{{ loading ? 'Salvando...' : 'Concluir' }}
						</button>
					</div>
				</div>

				<!-- Error Message -->
				<div v-if="error"
					class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
					{{ error }}
				</div>

			</div>
		</div>
	</div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.05);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
	border-radius: 3px;
}
</style>
