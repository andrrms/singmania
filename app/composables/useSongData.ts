import type { UltraStarSong } from '~/utils/ultrastarParser'

export interface SongState {
	song: UltraStarSong | null
	songId?: number
	audioSrc: string
	backgroundSrc: string | undefined
	gapOffset?: number
	isVideoBackground: boolean
	youtubeId: string | undefined
}

export const useSongData = () => {
	return useState<SongState>('songData', () => ({
		song: null,
		songId: undefined,
		audioSrc: '',
		backgroundSrc: undefined,
		gapOffset: 0,
		isVideoBackground: false,
		youtubeId: undefined
	}))
}
