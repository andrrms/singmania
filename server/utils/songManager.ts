import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

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

let cachedSongs: SongListItem[] | null = null

const extractHeaderValue = (content: string, tag: string): string | undefined => {
  const regex = new RegExp(`#${tag}:(.*)`, 'i')
  const match = content.match(regex)
  return match ? match[1].trim() : undefined
}

const extractYoutubeId = (content: string): string | undefined => {
  // Check #VIDEO:v=ID or #MP3:v=ID or #VIDEO:https://www.youtube.com/watch?v=ID
  const video = extractHeaderValue(content, 'VIDEO')
  const mp3 = extractHeaderValue(content, 'MP3')

  const check = (val?: string) => {
    if (!val) return undefined
    // Check for v=ID or a=ID
    if (val.includes('v=') || val.includes('a=')) {
      const match = val.match(/(?:v|a)=([a-zA-Z0-9_-]{11})/)
      return match ? match[1] : undefined
    }
    // Sometimes it might be just the ID if custom format, but standard UltraStar usually points to local file.
    // If it's a youtube link
    if (val.includes('youtube.com') || val.includes('youtu.be')) {
      const match = val.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
      return match ? match[1] : undefined
    }
    return undefined
  }

  return check(video) || check(mp3)
}

export interface SongFilterOptions {
  page: number
  limit: number
  search?: string
  type?: string
  language?: string
  sort?: string
}

export const getSongs = async (options: SongFilterOptions): Promise<{ data: SongListItem[], total: number }> => {
  const { page, limit, search, type, language, sort } = options
  const offset = (page - 1) * limit

  // 1. Supabase (Production)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
      let query = supabase
        .from('songs')
        .select('filename, title, artist, is_duet, cover, youtube_id, created_at, language', { count: 'exact' })

      // Search
      if (search) {
        query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`)
      }

      // Filters
      if (type === 'youtube') {
        query = query.not('youtube_id', 'is', null)
      } else if (type === 'local') {
        query = query.is('youtube_id', null)
      } else if (type === 'duet') {
        query = query.eq('is_duet', true)
      }

      if (language && language !== 'all') {
        query = query.ilike('language', language)
      }

      // Sort
      if (sort === 'date') {
        query = query.order('created_at', { ascending: false })
      } else if (sort === 'artist') {
        query = query.order('artist', { ascending: true })
      } else {
        query = query.order('title', { ascending: true })
      }

      // Pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('Supabase error in getSongs:', error)
      } else if (data) {
        const songs = data.map((s: any) => ({
          filename: s.filename,
          title: s.title,
          artist: s.artist,
          isDuet: s.is_duet,
          cover: s.cover,
          youtubeId: s.youtube_id,
          addedAt: new Date(s.created_at).getTime(),
          language: s.language
        }))
        return { data: songs, total: count || 0 }
      }
    } catch (e) {
      console.error('Error fetching songs from Supabase', e)
    }
  }

  // 2. Fallback (Local File System)
  const allSongs = await getSongList()
  
  let songs = allSongs

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
      return b.addedAt - a.addedAt
    } else if (sort === 'artist') {
      return a.artist.localeCompare(b.artist)
    } else {
      return a.title.localeCompare(b.title)
    }
  })

  const total = songs.length
  const paginatedSongs = songs.slice(offset, offset + limit)

  return {
    data: paginatedSongs,
    total
  }
}

export const getAvailableLanguages = async (): Promise<string[]> => {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
      // Fetch all languages to compute unique set. 
      // Ideally we would use a distinct query or a separate table for languages.
      const { data, error } = await supabase
        .from('songs')
        .select('language')
        .not('language', 'is', null)
      
      if (error) {
        console.error('Supabase error in getAvailableLanguages:', error)
      } else if (data) {
        const languages = new Set<string>()
        data.forEach((row: any) => {
          if (row.language) languages.add(row.language.trim())
        })
        return Array.from(languages).sort()
      }
    } catch (e) {
      console.error('Error fetching languages from Supabase', e)
    }
  }

  const songs = await getSongList()
  const languages = new Set<string>()
  songs.forEach(song => {
    if (song.language) {
      const lang = song.language.trim()
      if (lang) languages.add(lang)
    }
  })
  return Array.from(languages).sort()
}

export const getSongList = async (): Promise<SongListItem[]> => {
  if (cachedSongs) return cachedSongs

  // 1. Try to fetch from Supabase (Production/Cloud Source)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
      const { data, error } = await supabase
        .from('songs')
        .select('filename, title, artist, is_duet, cover, youtube_id, created_at, language')
      
      if (!error && data) {
        cachedSongs = data.map((s: any) => ({
            filename: s.filename,
            title: s.title,
            artist: s.artist,
            isDuet: s.is_duet,
            cover: s.cover,
            youtubeId: s.youtube_id,
            addedAt: new Date(s.created_at).getTime(),
            language: s.language
        }))
        return cachedSongs
      } else if (error) {
        console.error('Supabase error:', error)
      }
    } catch (e) {
      console.error('Error fetching songs from Supabase', e)
    }
  }

  // 2. Fallback to Local File System (Development)
  try {
    const SONGS_DIR = path.resolve(process.cwd(), 'public/songs')
    // Check if directory exists
    try {
      await fs.access(SONGS_DIR)
    } catch {
      return []
    }

    const files = await fs.readdir(SONGS_DIR)
    const txtFiles = files.filter(f => f.endsWith('.txt'))
    
    const songPromises = txtFiles.map(async (filename) => {
        try {
          const filePath = path.join(SONGS_DIR, filename)
          const content = await fs.readFile(filePath, 'utf-8')
          const stats = await fs.stat(filePath)
          const addedAt = stats.birthtimeMs || stats.mtimeMs
          
          return parseSong(filename, content, addedAt)
        } catch (e) {
          return null
        }
    })
    
    const results = await Promise.all(songPromises)
    cachedSongs = results.filter((s): s is SongListItem => s !== null)
    return cachedSongs
  } catch (e) {
    console.error('Error reading local songs directory', e)
    return []
  }
}

const parseSong = (filename: string, content: string, addedAt: number): SongListItem => {
    const title = extractHeaderValue(content, 'TITLE')
    const artist = extractHeaderValue(content, 'ARTIST')
    const language = extractHeaderValue(content, 'LANGUAGE')
    let cover = extractHeaderValue(content, 'COVER')
    const youtubeId = extractYoutubeId(content)

    // Fallback to filename parsing if tags are missing
    let finalTitle = title
    let finalArtist = artist

    if (!finalTitle || !finalArtist) {
      const nameWithoutExt = filename.replace(/\.txt$/, '')
      const parts = nameWithoutExt.split(' - ')
      if (parts.length >= 2) {
        if (!finalArtist) finalArtist = parts[0].trim()
        if (!finalTitle) finalTitle = parts.slice(1).join(' - ').trim()
      } else {
        if (!finalTitle) finalTitle = nameWithoutExt
        if (!finalArtist) finalArtist = 'Unknown'
      }
    }

    const isDuet = filename.toUpperCase().includes('DUET') || (content.includes('P1') && content.includes('P2'))

    // Generate Cover URL if missing but we have YouTube ID
    if (!cover && youtubeId) {
      cover = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    }

    return {
      filename,
      title: finalTitle || filename,
      artist: finalArtist || 'Unknown',
      isDuet,
      cover,
      youtubeId,
      addedAt,
      language
    }
}

export const getSongContent = async (filename: string): Promise<string | null> => {
  // 1. Try Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
        const { data, error } = await supabase
            .from('songs')
            .select('content')
            .eq('filename', filename)
            .single()
        
        if (error) {
            console.error(`Supabase error reading content for ${filename}:`, error)
        } else if (data) {
            return data.content
        }
    } catch (e) {
        console.error(`Error reading song content from Supabase ${filename}`, e)
    }
  }

  // 2. Fallback to Local
  try {
    const SONGS_DIR = path.resolve(process.cwd(), 'public/songs')
    const filePath = path.join(SONGS_DIR, filename)
    return await fs.readFile(filePath, 'utf-8')
  } catch (e) {
    console.error(`Error reading song content ${filename}`, e)
    return null
  }
}
