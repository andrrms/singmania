import fs from 'node:fs/promises'
import path from 'node:path'
import { Buffer } from 'node:buffer'

const SONGS_DIR = path.resolve(process.cwd(), 'public/songs')
const DEMO_SONGS_DIR = path.resolve(process.cwd(), 'public/demo_songs_old')

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
    const files = await fs.readdir(SONGS_DIR)
    const txtFiles = files.filter((f: string) => f.endsWith('.txt'))

    const songPromises = txtFiles.map(async (filename: string) => {
      try {
        const filePath = path.join(SONGS_DIR, filename)
        // Read first 2KB to get headers
        const fileHandle = await fs.open(filePath, 'r')
        const buffer = Buffer.alloc(2048)
        const { bytesRead } = await fileHandle.read(buffer, 0, 2048, 0)
        await fileHandle.close()

        const stats = await fs.stat(filePath)
        const addedAt = stats.birthtimeMs || stats.mtimeMs

        const content = buffer.toString('utf-8', 0, bytesRead)

        const title = extractHeaderValue(content, 'TITLE')
        const artist = extractHeaderValue(content, 'ARTIST')
        const language = extractHeaderValue(content, 'LANGUAGE')
        let cover = extractHeaderValue(content, 'COVER')
        const youtubeId = extractYoutubeId(content)

        // Filter: Must have YouTube ID - REMOVED to allow local songs
        // if (!youtubeId) return null

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
      } catch (e) {
        console.error(`Error parsing ${filename}`, e)
        return null
      }
    })

    const results = await Promise.all(songPromises)
    cachedSongs = results.filter((s: any): s is SongListItem => s !== null)

    return cachedSongs || []
  } catch (e) {
    console.error('Error reading songs directory', e)
    return []
  }
}

export const getSongContent = async (filename: string): Promise<string | null> => {
  try {
    // Try main songs dir
    const filePath = path.join(SONGS_DIR, filename)
    return await fs.readFile(filePath, 'utf-8')
  } catch (e) {
    // Try demo songs dir as fallback
    try {
      const demoPath = path.join(DEMO_SONGS_DIR, filename)
      return await fs.readFile(demoPath, 'utf-8')
    } catch (e2) {
      return null
    }
  }
}
