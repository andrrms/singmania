import fs from 'node:fs/promises'
import path from 'node:path'
import { list } from '@vercel/blob'

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
let cachedManifestUrl: string | null = null

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

  // 1. Try to fetch from Vercel Blob Manifest first (Production/Cloud Source)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      // Find the manifest file URL
      if (!cachedManifestUrl) {
        const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN })
        const manifest = blobs.find(b => b.pathname === 'songs_manifest.json')
        if (manifest) {
          cachedManifestUrl = manifest.url
        }
      }

      if (cachedManifestUrl) {
        const response = await fetch(cachedManifestUrl)
        if (response.ok) {
          const songs = await response.json()
          cachedSongs = songs
          return songs
        }
      }
    } catch (e) {
      console.error('Error fetching songs from Vercel Blob', e)
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
  // 1. Try Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
        const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, prefix: filename })
        // Exact match check or just take the first one that matches the filename
        const blob = blobs.find(b => b.pathname === filename)
        if (blob) {
            const response = await fetch(blob.url)
            if (response.ok) {
                return await response.text()
            }
        }
    } catch (e) {
        console.error(`Error reading song content from Blob ${filename}`, e)
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
