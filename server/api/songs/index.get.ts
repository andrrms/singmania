
import { getSongList } from '../../utils/songManager'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 50
  const search = (query.search as string || '').toLowerCase()
  const sort = (query.sort as string || 'title')
  const type = (query.type as string || 'all')
  const language = (query.language as string || 'all')

  let songs = await getSongList()

  // Type Filter
  if (type === 'youtube') {
    songs = songs.filter(s => !!s.youtubeId)
  } else if (type === 'local') {
    songs = songs.filter(s => !s.youtubeId)
  } else if (type === 'duet') {
    songs = songs.filter(s => s.isDuet)
  }

  // Language Filter
  if (language && language !== 'all') {
    const lang = language.toLowerCase()
    songs = songs.filter(s => s.language?.toLowerCase() === lang)
  }

  // Search
  if (search) {
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const searchNormalized = normalize(search)

    songs = songs.filter(s =>
      normalize(s.title).includes(searchNormalized) ||
      normalize(s.artist).includes(searchNormalized)
    )
  }

  // Sort
  songs.sort((a, b) => {
    if (sort === 'date') {
      return b.addedAt - a.addedAt // Newest first
    } else if (sort === 'artist') {
      return a.artist.localeCompare(b.artist)
    } else {
      return a.title.localeCompare(b.title)
    }
  })

  const total = songs.length
  const start = (page - 1) * limit
  const end = start + limit
  const paginatedSongs = songs.slice(start, end)

  return {
    data: paginatedSongs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
})
