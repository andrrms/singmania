import { defineStore } from 'pinia'
import type { UltraStarSong } from '~/utils/ultrastarParser'

export interface SongState {
  song: UltraStarSong | null
  songId?: number
  audioSrc: string
  backgroundSrc: string | undefined
  coverSrc: string | undefined
  gapOffset: number
  isVideoBackground: boolean
  youtubeId: string | undefined
}

export const useSongStore = defineStore('song', {
  state: (): SongState => ({
    song: null,
    songId: undefined,
    audioSrc: '',
    backgroundSrc: undefined,
    coverSrc: undefined,
    gapOffset: 0,
    isVideoBackground: false,
    youtubeId: undefined
  }),
  actions: {
    setSong(data: Partial<SongState>) {
      this.$patch(data)
    },
    reset() {
      // Cleanup URLs to avoid memory leaks
      if (this.audioSrc && this.audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioSrc)
      }
      if (this.backgroundSrc && this.backgroundSrc.startsWith('blob:')) {
        URL.revokeObjectURL(this.backgroundSrc)
      }
      if (this.coverSrc && this.coverSrc.startsWith('blob:')) {
        URL.revokeObjectURL(this.coverSrc)
      }
      
      this.$reset()
    }
  }
})
