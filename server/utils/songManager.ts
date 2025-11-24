import fs from 'node:fs/promises'
import path from 'node:path'

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

export const getSongList = async (): Promise<SongListItem[]> => {
  if (cachedSongs) return cachedSongs

  try {
    const storage = useStorage('assets:songs')
    let keys = await storage.getKeys()
    
    // Fallback for local development if server assets are not mounted correctly
    if (keys.length === 0 && process.env.NODE_ENV === 'development') {
      try {
        const SONGS_DIR = path.resolve(process.cwd(), 'public/songs')
        const files = await fs.readdir(SONGS_DIR)
        keys = files.filter(f => f.endsWith('.txt'))
        
        // Map FS files to storage-like behavior or just process them
        // To keep logic unified, we will process them similarly but we need to read content differently
        // So let's branch out here
        const songPromises = keys.map(async (filename) => {
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
      }
    }

    const txtFiles = keys.filter((k: string) => k.endsWith('.txt'))

    const songPromises = txtFiles.map(async (key: string): Promise<SongListItem | null> => {
      try {
        const content = await storage.getItem(key) as string
        if (!content) return null

        // We don't have reliable file stats in all storage drivers, use current time or 0
        const meta = await storage.getMeta(key)
        const mtime = meta?.mtime
        const addedAt = mtime ? new Date(mtime).getTime() : 0

        return parseSong(key, content, addedAt)
      } catch (e) {
        console.error(`Error parsing ${key}`, e)
        return null
      }
    })

    const results = await Promise.all(songPromises)
    const validSongs = results.filter((s): s is SongListItem => s !== null)
    cachedSongs = validSongs

    return cachedSongs || []
  } catch (e) {
    console.error('Error reading songs directory', e)
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
  try {
    const storage = useStorage('assets:songs')
    const content = await storage.getItem(filename)
    if (content) return content as string
    
    if (process.env.NODE_ENV === 'development') {
        const SONGS_DIR = path.resolve(process.cwd(), 'public/songs')
        const filePath = path.join(SONGS_DIR, filename)
        return await fs.readFile(filePath, 'utf-8')
    }
    return null
  } catch (e) {
    console.error(`Error reading song content ${filename}`, e)
    return null
  }
}
