import { put, list } from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const SONGS_DIR = path.resolve(process.cwd(), 'public/songs');

async function syncSongs() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN is not defined in .env');
    process.exit(1);
  }

  console.log('Starting sync to Vercel Blob...');

  // 1. Get local files
  const files = await fs.readdir(SONGS_DIR);
  const txtFiles = files.filter(f => f.endsWith('.txt'));
  console.log(`Found ${txtFiles.length} local song files.`);

  // 2. Parse local files to generate metadata
  const songsMetadata = [];
  
  for (const filename of txtFiles) {
    const filePath = path.join(SONGS_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    
    // Parse metadata locally
    const extractHeader = (tag) => {
      const match = content.match(new RegExp(`#${tag}:(.*)`, 'i'));
      return match ? match[1].trim() : undefined;
    };

    const extractYoutubeId = () => {
        const video = extractHeader('VIDEO');
        const mp3 = extractHeader('MP3');
        const check = (val) => {
            if (!val) return undefined;
            if (val.includes('v=') || val.includes('a=')) {
                const match = val.match(/(?:v|a)=([a-zA-Z0-9_-]{11})/);
                return match ? match[1] : undefined;
            }
            if (val.includes('youtube.com') || val.includes('youtu.be')) {
                const match = val.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                return match ? match[1] : undefined;
            }
            return undefined;
        };
        return check(video) || check(mp3);
    };

    const title = extractHeader('TITLE');
    const artist = extractHeader('ARTIST');
    const language = extractHeader('LANGUAGE');
    let cover = extractHeader('COVER');
    const youtubeId = extractYoutubeId();

    let finalTitle = title;
    let finalArtist = artist;

    if (!finalTitle || !finalArtist) {
        const nameWithoutExt = filename.replace(/\.txt$/, '');
        const parts = nameWithoutExt.split(' - ');
        if (parts.length >= 2) {
            if (!finalArtist) finalArtist = parts[0].trim();
            if (!finalTitle) finalTitle = parts.slice(1).join(' - ').trim();
        } else {
            if (!finalTitle) finalTitle = nameWithoutExt;
            if (!finalArtist) finalArtist = 'Unknown';
        }
    }

    const isDuet = filename.toUpperCase().includes('DUET') || (content.includes('P1') && content.includes('P2'));

    if (!cover && youtubeId) {
        cover = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    songsMetadata.push({
        filename,
        title: finalTitle || filename,
        artist: finalArtist || 'Unknown',
        isDuet,
        cover,
        youtubeId,
        addedAt: stats.birthtimeMs || stats.mtimeMs,
        language
    });
  }

  // 3. Upload files to Blob (if not exists)
  // To avoid re-uploading everything, we can check list() first, but for simplicity/robustness 
  // we might want to just upload or check existence. 
  // Let's check existing blobs first to save bandwidth.
  console.log('Fetching existing blobs...');
  const { blobs } = await list({ token });
  const existingFilenames = new Set(blobs.map(b => b.pathname));

  console.log('Uploading missing song files...');
  for (const file of txtFiles) {
    if (!existingFilenames.has(file)) {
        console.log(`Uploading ${file}...`);
        const filePath = path.join(SONGS_DIR, file);
        const content = await fs.readFile(filePath);
        await put(file, content, { access: 'public', token });
    }
  }

  // 4. Upload metadata JSON
  // We upload this as 'songs_manifest.json'
  console.log('Uploading songs_manifest.json...');
  await put('songs_manifest.json', JSON.stringify(songsMetadata), { access: 'public', token, addRandomSuffix: false });

  console.log('Sync complete!');
}

syncSongs().catch(console.error);
