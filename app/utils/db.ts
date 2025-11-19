import type { UltraStarSong } from './ultrastarParser'

export interface SavedSong {
	id?: number
	title: string
	artist: string
	txtContent: string
	audioBlob?: Blob
	backgroundBlob?: Blob
	coverBlob?: Blob
	gapOffset?: number
	isVideoBackground: boolean
	youtubeId?: string
	addedAt: number
}

const DB_NAME = 'karaoke-db'
const DB_VERSION = 2
const STORE_NAME = 'songs'

export const initDB = (): Promise<IDBDatabase> => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = (event) => {
			console.error('IndexedDB error:', event)
			reject('Error opening database')
		}

		request.onsuccess = (event) => {
			resolve((event.target as IDBOpenDBRequest).result)
		}

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
				store.createIndex('title_artist', ['title', 'artist'], { unique: false })
			} else {
				// Version 2 upgrade: Ensure structure is compatible (IndexedDB is flexible with objects, so just bumping version is enough to trigger upgrade if needed, but we don't need schema changes for new fields in objects)
			}
		}
	})
}

export const updateSong = async (id: number, updates: Partial<SavedSong>): Promise<void> => {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)
		const request = store.get(id)

		request.onsuccess = () => {
			const data = request.result
			if (!data) {
				reject('Song not found')
				return
			}
			
			const updatedData = { ...data, ...updates }
			const updateRequest = store.put(updatedData)
			
			updateRequest.onsuccess = () => resolve()
			updateRequest.onerror = () => reject('Error updating song')
		}
		
		request.onerror = () => reject('Error fetching song for update')
	})
}

export const saveSong = async (song: SavedSong): Promise<number> => {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)

		// Check for existing song with same title and artist
		const index = store.index('title_artist')
		const request = index.get([song.title, song.artist])

		request.onsuccess = () => {
			const existing = request.result
			if (existing) {
				// Update existing
				song.id = existing.id
				const updateRequest = store.put(song)
				updateRequest.onsuccess = () => resolve(existing.id!)
				updateRequest.onerror = () => reject('Error updating song')
			} else {
				// Add new
				const addRequest = store.add(song)
				addRequest.onsuccess = () => resolve(addRequest.result as number)
				addRequest.onerror = () => reject('Error adding song')
			}
		}

		request.onerror = () => reject('Error checking for existing song')
	})
}

export const getSongs = async (): Promise<SavedSong[]> => {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readonly')
		const store = transaction.objectStore(STORE_NAME)
		const request = store.getAll()

		request.onsuccess = () => {
			resolve(request.result)
		}

		request.onerror = () => reject('Error getting songs')
	})
}

export const deleteSong = async (id: number): Promise<void> => {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)
		const request = store.delete(id)

		request.onsuccess = () => resolve()
		request.onerror = () => reject('Error deleting song')
	})
}

export const clearSongs = async (): Promise<void> => {
	const db = await initDB()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite')
		const store = transaction.objectStore(STORE_NAME)
		const request = store.clear()

		request.onsuccess = () => resolve()
		request.onerror = () => reject('Error clearing songs')
	})
}
