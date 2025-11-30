import { ref, watch, computed, onMounted } from 'vue'
import { getCachedLibrary, cacheLibrary } from '~/utils/db'

export interface SongListItem {
  filename: string
  title: string
  artist: string
  isDuet: boolean
  cover?: string
  youtubeId?: string
  addedAt: number
  language?: string
}

// Global state for the full library
const useAllSongs = () => useState<SongListItem[]>('all_songs', () => [])
const useLibraryStatus = () => useState<{ loaded: boolean, checking: boolean }>('library_status', () => ({ loaded: false, checking: false }))

export const useLibrary = () => {
  const allSongs = useAllSongs()
  const status = useLibraryStatus()

  const songs = ref<SongListItem[]>([])
  const loading = ref(false)
  const search = ref('')
  const typeFilter = ref('all')
  const languageFilter = ref('all')
  const sort = ref<'title' | 'artist' | 'date'>('title')
  const page = ref(1)
  const limit = ref(50)

  // Computed properties for filtering and sorting
  const filteredSongs = computed(() => {
    let result = [...allSongs.value]

    // Type Filter
    if (typeFilter.value === 'youtube') {
      result = result.filter(s => !!s.youtubeId)
    } else if (typeFilter.value === 'local') {
      result = result.filter(s => !s.youtubeId)
    } else if (typeFilter.value === 'duet') {
      result = result.filter(s => s.isDuet)
    }

    // Language Filter
    if (languageFilter.value && languageFilter.value !== 'all') {
      const lang = languageFilter.value.toLowerCase()
      result = result.filter(s => s.language?.toLowerCase() === lang)
    }

    // Search
    if (search.value) {
      const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase()
      const searchNormalized = normalize(search.value)

      result = result.filter(s =>
        normalize(s.title).includes(searchNormalized) ||
        normalize(s.artist).includes(searchNormalized)
      )
    }

    // Sort
    result.sort((a, b) => {
      if (sort.value === 'date') {
        return b.addedAt - a.addedAt
      } else if (sort.value === 'artist') {
        return a.artist.localeCompare(b.artist)
      } else {
        return a.title.localeCompare(b.title)
      }
    })

    return result
  })

  const total = computed(() => filteredSongs.value.length)
  const totalPages = computed(() => Math.ceil(total.value / limit.value))
  const hasMore = computed(() => page.value < totalPages.value)

  const updateView = (append = false) => {
    const offset = (page.value - 1) * limit.value
    const slice = filteredSongs.value.slice(offset, offset + limit.value)

    if (append) {
      songs.value = [...songs.value, ...slice]
    } else {
      songs.value = slice
    }
  }

  const initializeLibrary = async () => {
    if (!import.meta.client) return
    if (status.value.checking) return
    status.value.checking = true
    loading.value = true


    try {
      // 1. Check IDB Cache
      const cached = await getCachedLibrary()
      let shouldUseCache = false

      if (cached) {
        const { stats } = cached
        const now = Date.now()
        const cacheAge = now - stats.lastFetch
        const oneWeek = 7 * 24 * 60 * 60 * 1000

        if (cacheAge < oneWeek) {
          // Cache is fresh enough to check for updates
          try {
            const serverStats = await $fetch<{ count: number, lastUpdated: number }>('/api/songs/stats')

            if (serverStats.count === stats.count && serverStats.lastUpdated === stats.lastUpdated) {
              shouldUseCache = true
            }
          } catch (e) {
            // If offline or error, use cache
            console.warn('Failed to check updates, using cache', e)
            shouldUseCache = true
          }
        }
      }

      if (shouldUseCache && cached) {
        console.log('[useLibrary] Using cached library')
        allSongs.value = cached.songs
        status.value.loaded = true
      } else {
        console.log('[useLibrary] Fetching full library')
        // Fetch full library
        const response = await $fetch<{ data: SongListItem[], meta: { total: number } }>('/api/songs', {
          query: { limit: -1 }
        })
        console.log(response);

        if (response && response.data) {
          allSongs.value = response.data

          // Calculate stats for cache
          const lastUpdated = allSongs.value.reduce((max, s) => Math.max(max, s.addedAt), 0)
          const stats = {
            count: allSongs.value.length,
            lastUpdated
          }

          // Save to IDB
          await cacheLibrary(allSongs.value, stats)
          status.value.loaded = true
        }
      }
    } catch (e) {
      console.error('Failed to initialize library', e)
    } finally {
      status.value.checking = false
      loading.value = false
      updateView()
    }
  }

  const fetchSongs = async (append = false) => {
    if (!status.value.loaded && !status.value.checking) {
      await initializeLibrary()
    } else if (status.value.checking) {
      // Wait for initialization
      const unwatch = watch(() => status.value.checking, (val) => {
        if (!val) {
          updateView(append)
          unwatch()
        }
      })
    } else {
      updateView(append)
    }
  }

  const refreshSongs = () => {
    page.value = 1
    fetchSongs(false)
  }

  const loadMore = () => {
    if (hasMore.value && !loading.value) {
      page.value++
      fetchSongs(true)
    }
  }

  // Reset pagination when filters change
  watch([search, typeFilter, languageFilter, sort], () => {
    page.value = 1
    updateView()
  })

  // Initial load if needed
  if (allSongs.value.length > 0) {
    // If already loaded, just update view
    updateView()
  }

  onMounted(() => {
    if (import.meta.client && !status.value.loaded && !status.value.checking && allSongs.value.length === 0) {
      initializeLibrary()
    }
  })


  return {
    songs,
    loading,
    search,
    typeFilter,
    languageFilter,
    sort,
    page,
    limit,
    total,
    totalPages,
    hasMore,
    fetchSongs,
    refreshSongs,
    loadMore
  }
}

