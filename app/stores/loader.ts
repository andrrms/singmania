import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoaderStore = defineStore('loader', () => {
	const isLoading = ref(false)
	const progress = ref(0)
	const total = ref(0)
	const currentFile = ref('')
	const showProgress = ref(false)

	const startLoading = (totalFiles: number, hasNewContent: boolean = true) => {
		isLoading.value = true
		progress.value = 0
		total.value = totalFiles
		showProgress.value = hasNewContent
	}

	const incrementProgress = (filename: string) => {
		progress.value++
		currentFile.value = filename
	}

	const finishLoading = () => {
		isLoading.value = false
		progress.value = total.value
	}

	return {
		isLoading,
		progress,
		total,
		currentFile,
		showProgress,
		startLoading,
		incrementProgress,
		finishLoading
	}
})
