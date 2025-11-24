import { getSongList } from '../utils/songManager'

export default defineEventHandler(async (event) => {
	const songs = await getSongList()

	// Extract unique languages
	const languages = new Set<string>()
	songs.forEach(song => {
		if (song.language) {
			// Normalize language (capitalize first letter, trim)
			const lang = song.language.trim()
			if (lang) {
				languages.add(lang)
			}
		}
	})

	// Convert to array and sort
	return Array.from(languages).sort()
})
