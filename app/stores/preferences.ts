import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const usePreferencesStore = defineStore('preferences', () => {
	const viewMode = useStorage<'grid' | 'list' | 'grid-list'>('library-view-mode', 'grid')
	const sortBy = useStorage<'title' | 'artist' | 'date'>('library-sort-by', 'title')
	const debugMode = useStorage('player-debug-mode', false)
	const inputDeviceId = useStorage<string>('input-device-id', 'default')
	const inputGain = useStorage<number>('input-gain', 1.0)

	return {
		viewMode,
		sortBy,
		debugMode,
		inputDeviceId,
		inputGain
	}
})
