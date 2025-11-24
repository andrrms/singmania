import { defineStore } from 'pinia'
import type { UltraStarSong, UltraStarLine, UltraStarNote, UltraStarWord } from '~/utils/ultrastarParser'
import { parseUltraStar, stringifyUltraStar } from '~/utils/ultrastarParser'

export type EditorTool = 'select' | 'move' | 'create' | 'split' | 'erase'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    song: null as UltraStarSong | null,
    fileHandle: null as FileSystemFileHandle | null,
    mediaSource: null as File | string | null, // File object or YouTube URL
    mediaType: 'none' as 'local' | 'youtube' | 'none',
    isProjectLoaded: false,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    verticalZoom: 20, // pixels per semitone
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'select' as EditorTool,
    selectedNotes: [] as UltraStarNote[],
    gridSize: 4, // 1/4 beat
    bpm: 200, // Default BPM if not set
    gap: 0,
    wizardLyrics: '', // Persist wizard lyrics
    zoom: 50, // Default zoom (pixels per second)
  }),

  actions: {
    initNewSong(metadata: any = {}) {
      this.song = {
        metadata: {
          TITLE: 'New Song',
          ARTIST: 'Unknown Artist',
          BPM: '200',
          GAP: '0',
          ...metadata
        },
        lines: []
      }
      this.bpm = parseFloat(this.song.metadata.BPM || '200')
      this.gap = parseFloat(this.song.metadata.GAP || '0')
      this.fileHandle = null
      this.mediaSource = null
      this.mediaType = 'none'
      this.isProjectLoaded = true
    },

    resetSong() {
      if (this.song) {
        this.song.lines = []
        this.selectedNotes = []
      }
      this.wizardLyrics = ''
    },

    async loadSongFromFile(file: File) {
      const text = await file.text()
      this.song = parseUltraStar(text)
      this.bpm = parseFloat(this.song.metadata.BPM?.replace(',', '.') || '200')
      this.gap = parseFloat(this.song.metadata.GAP?.replace(',', '.') || '0')
      
      // Heuristic: Shift pitches if they seem to be relative (low values)
      // Standard UltraStar often uses relative pitches where 0 is C4 (60) or similar.
      // If we detect low average pitch, we shift.
      if (this.song.lines.length > 0) {
        let totalPitch = 0
        let count = 0
        this.song.lines.forEach(l => l.words.forEach(w => w.notes.forEach(n => {
          totalPitch += n.pitch
          count++
        })))
        
        const avgPitch = count > 0 ? totalPitch / count : 0
        
        // If average pitch is very low (e.g. < 20), assume it's relative to C4 (60)
        // But wait, some formats use 0 as C4.
        // If avg is around 0, we add 60.
        if (avgPitch < 30) {
           this.song.lines.forEach(l => l.words.forEach(w => w.notes.forEach(n => {
             n.pitch += 60
           })))
        }
      }
      
      // Calculate duration from last note
      let maxTime = 0
      if (this.song.lines.length > 0) {
        const lastLine = this.song.lines[this.song.lines.length - 1]
        if (lastLine && lastLine.endTime) {
          maxTime = lastLine.endTime
        }
      }
      this.duration = Math.max(maxTime + 10, 300) // At least 5 mins or last note + 10s

      // Load video if present
      if (this.song.metadata.VIDEO) {
        const video = this.song.metadata.VIDEO
        if (video.startsWith('http') || video.includes('youtube')) {
           this.setMedia(video, 'youtube')
        }
      }

      this.isProjectLoaded = true
    },

    closeProject() {
      this.song = null
      this.isProjectLoaded = false
      this.mediaSource = null
      this.mediaType = 'none'
      this.isPlaying = false
    },

    setMedia(source: File | string, type: 'local' | 'youtube') {
      this.mediaSource = source
      this.mediaType = type
      
      if (type === 'youtube' && typeof source === 'string' && this.song) {
        this.song.metadata.VIDEO = source
      }
    },

    updateMetadata(key: string, value: string) {
      if (!this.song) return
      this.song.metadata[key] = value
      if (key === 'BPM') this.bpm = parseFloat(value.replace(',', '.') || '0')
      if (key === 'GAP') this.gap = parseFloat(value.replace(',', '.') || '0')
    },

    // Note operations
    addNote(lineIndex: number, wordIndex: number, note: UltraStarNote) {
      if (!this.song) return
      // Logic to insert note
      // This is complex because we need to handle lines and words structure
      // For simplicity, let's assume we are manipulating a flat list of notes in the UI 
      // and reconstructing the structure, or we maintain the structure carefully.
    },

    splitNote(lineIndex: number, wordIndex: number, noteIndex: number, splitOffset: number) {
      if (!this.song) return
      const line = this.song.lines[lineIndex]
      if (!line) return
      const word = line.words[wordIndex]
      if (!word) return
      const note = word.notes[noteIndex]
      if (!note) return
      
      const firstDuration = splitOffset
      const secondDuration = note.duration - splitOffset
      
      if (firstDuration <= 0 || secondDuration <= 0) return
      
      const firstNote: UltraStarNote = { ...note, duration: firstDuration }
      const secondNote: UltraStarNote = { 
        ...note, 
        startBeat: note.startBeat + firstDuration, 
        duration: secondDuration,
        text: '~' // Default to extension/tilde for the second part
      }
      
      // Update current note
      word.notes[noteIndex] = firstNote
      // Insert new note
      word.notes.splice(noteIndex + 1, 0, secondNote)
    },

    deleteNote(lineIndex: number, wordIndex: number, noteIndex: number) {
      if (!this.song) return
      const line = this.song.lines[lineIndex]
      if (!line) return
      const word = line.words[wordIndex]
      if (!word) return
      
      word.notes.splice(noteIndex, 1)
      
      // Cleanup empty words/lines
      if (word.notes.length === 0) {
        line.words.splice(wordIndex, 1)
      }
      if (line.words.length === 0) {
        this.song.lines.splice(lineIndex, 1)
      }
      
      // Deselect if deleted
      this.selectedNotes = []
    },

    // ... other actions
  },
  
  getters: {
    // Helper to get all notes as a flat array for the timeline
    allNotes: (state) => {
      if (!state.song) return []
      const notes: { note: UltraStarNote, lineIndex: number, wordIndex: number, noteIndex: number }[] = []
      state.song.lines.forEach((line, lIdx) => {
        line.words.forEach((word, wIdx) => {
          word.notes.forEach((note, nIdx) => {
            notes.push({ note, lineIndex: lIdx, wordIndex: wIdx, noteIndex: nIdx })
          })
        })
      })
      return notes
    }
  }
})
