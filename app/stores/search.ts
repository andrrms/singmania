import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SongListItem } from '~/composables/useLibrary'

export const useSearchStore = defineStore('search', () => {
	const searchQuery = ref('')

	const setQuery = (query: string) => {
		searchQuery.value = query
	}

	const appendChar = (char: string) => {
		searchQuery.value += char
	}

	const clear = () => {
		searchQuery.value = ''
	}

	const suggestions = ref<SongListItem[]>([])

	return {
		searchQuery,
		suggestions,
		setQuery,
		appendChar,
		clear
	}
})
