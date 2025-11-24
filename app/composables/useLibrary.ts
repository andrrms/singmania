import { ref, watch } from 'vue'

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

export const useLibrary = () => {
  const songs = ref<SongListItem[]>([])
  const loading = ref(false)
  const search = ref('')
  const typeFilter = ref('all')
  const languageFilter = ref('all')
  const sort = ref('title')
  const page = ref(1)
  const limit = ref(50)
  const total = ref(0)
  const totalPages = ref(0)
  const hasMore = ref(true)

  const fetchSongs = async (append = false) => {
    if (loading.value && append) return
    loading.value = true

    try {
      const response = await $fetch<{ data: SongListItem[], meta: { total: number, totalPages: number } }>('/api/songs', {
        query: {
          limit: limit.value,
          page: page.value,
          search: search.value,
          type: typeFilter.value,
          language: languageFilter.value,
          sort: sort.value
        }
      })

      if (response) {
        const newSongs = response.data
        total.value = response.meta.total
        totalPages.value = response.meta.totalPages

        if (append) {
          songs.value = [...songs.value, ...newSongs]
        } else {
          songs.value = newSongs
        }

        hasMore.value = page.value < totalPages.value
      }
    } catch (e) {
      console.error('Failed to load songs', e)
    } finally {
      loading.value = false
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
    hasMore.value = true
    fetchSongs()
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
