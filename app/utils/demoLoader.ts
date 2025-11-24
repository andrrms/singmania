import { saveSong, getSongs } from './db'
import { parseUltraStar } from './ultrastarParser'
import { useLoaderStore } from '~/stores/loader'

const CACHE_KEY = 'imported_songs_map'

export const loadDemoSongs = async () => {
	const loaderStore = useLoaderStore()
	
	try {
		// 1. Fetch list of available song files
		const response = await fetch('/songs_list.json')
		if (!response.ok) {
			console.warn('songs_list.json not found, skipping bulk load')
			return
		}
		const songFiles: string[] = await response.json()

		// 3. Get existing songs from DB to avoid duplicates
		const existingSongs = await getSongs()
		const existingSignatures = new Set(existingSongs.map(s => `${s.title.toUpperCase()}|${s.artist.toUpperCase()}`))

		// 4. Load filename mapping from LocalStorage
		let filenameMap: Record<string, string> = {}
		try {
			const cached = localStorage.getItem(CACHE_KEY)
			if (cached) filenameMap = JSON.parse(cached)
		} catch (e) {
			console.error('Error reading filename cache', e)
		}

		// Pre-calculate if we have new songs to load
		let hasNewSongs = false
		for (const filename of songFiles) {
			const cachedSignature = filenameMap[filename]
			if (!cachedSignature || !existingSignatures.has(cachedSignature)) {
				hasNewSongs = true
				break
			}
		}

		// 2. Initialize Loader
		loaderStore.startLoading(songFiles.length, hasNewSongs)

		let newSongsCount = 0
		let mapChanged = false

		// 5. Process files
		for (const filename of songFiles) {
			loaderStore.incrementProgress(filename)

			try {
				// Check if we know this file and if it's already in DB
				const cachedSignature = filenameMap[filename]
				if (cachedSignature && existingSignatures.has(cachedSignature)) {
					// Already exists, skip
					continue
				}

				// If not in cache or not in DB, we need to load and parse
				const res = await fetch(`/songs/${encodeURIComponent(filename)}`)
				if (!res.ok) {
					// Try demo_songs folder as fallback if user moved things around or if list includes both
					const resDemo = await fetch(`/demo_songs/${encodeURIComponent(filename)}`)
					if (!resDemo.ok) continue
				}
				
				const text = await res.text()
				const song = parseUltraStar(text)
				
				const title = (song.metadata.TITLE || 'Unknown').trim()
				const artist = (song.metadata.ARTIST || 'Unknown').trim()
				const signature = `${title.toUpperCase()}|${artist.toUpperCase()}`

				// Update map
				filenameMap[filename] = signature
				mapChanged = true

				// Check DB again (in case of duplicates within the list itself)
				if (existingSignatures.has(signature)) {
					continue
				}

				// Check for YouTube ID
				let youtubeId: string | undefined
				const videoTag = song.metadata['VIDEO']
				if (videoTag && videoTag.includes('v=')) {
					const match = videoTag.match(/v=([^,]+)/)
					if (match) {
						youtubeId = match[1]
					}
				}

				await saveSong({
					title: title,
					artist: artist,
					txtContent: text,
					isVideoBackground: false,
					youtubeId: youtubeId,
					addedAt: Date.now()
				})

				existingSignatures.add(signature)
				newSongsCount++

				// Small delay to allow UI updates if main thread is busy (though fetch is async)
				await new Promise(r => setTimeout(r, 0))

			} catch (e) {
				console.error(`Failed to load song ${filename}`, e)
			}
		}

		// 6. Save updated map
		if (mapChanged) {
			localStorage.setItem(CACHE_KEY, JSON.stringify(filenameMap))
		}

		console.log(`Import finished. ${newSongsCount} new songs added.`)

	} catch (e) {
		console.error('Error loading songs', e)
	} finally {
		loaderStore.finishLoading()
	}
}

