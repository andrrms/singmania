export interface UltraStarNote {
	type: ':' | '*' | 'F' | 'R' | 'G'
	startBeat: number
	duration: number
	pitch: number
	text: string
	isExtension: boolean
	startTime?: number
	endTime?: number
}

export interface UltraStarWord {
	notes: UltraStarNote[]
}

export interface UltraStarLine {
	words: UltraStarWord[]
	startTime?: number
	endTime?: number
	player?: 1 | 2
}

export interface UltraStarSong {
	metadata: Record<string, string>
	lines: UltraStarLine[]
}

export const parseUltraStar = (text: string): UltraStarSong => {
	const metadata: Record<string, string> = {}
	const lines: UltraStarLine[] = []

	let currentLine: UltraStarLine = { words: [], player: 1 }
	let currentWord: UltraStarWord = { notes: [] }
	let currentPlayer: 1 | 2 = 1

	const rawLines = text.replace(/\r/g, '').split('\n')
	let previousNoteEndedWithSpace = false

	for (const line of rawLines) {
		if (line.startsWith('#')) {
			const [key, ...value] = line.substring(1).split(':')
			if (key && value) {
				metadata[key.toUpperCase()] = value.join(':').trim()
			}
		} else if (line.startsWith('P')) {
			// Player change (P1, P2, P3?)
			// P1 = Player 1, P2 = Player 2
			const p = parseInt(line.substring(1))
			if (p === 1 || p === 2) {
				// If we have pending words, push them to the current line before switching?
				// Usually P tags appear between lines.
				if (currentWord.notes.length > 0) {
					currentLine.words.push(currentWord)
					currentWord = { notes: [] }
				}
				if (currentLine.words.length > 0) {
					lines.push(currentLine)
					currentLine = { words: [], player: currentPlayer } // Push old line
				}
				
				currentPlayer = p
				currentLine = { words: [], player: currentPlayer }
			}
		} else if (line.startsWith(':') || line.startsWith('*') || line.startsWith('F') || line.startsWith('R') || line.startsWith('G')) {
			const parts = line.split(' ')
			const type = parts[0] as ':' | '*' | 'F' | 'R' | 'G'
			const startBeat = parseInt(parts[1] || '0')
			const duration = parseInt(parts[2] || '0')
			const pitch = parseInt(parts[3] || '0')
			let text = parts.slice(4).join(' ')

			// Check spaces before modifying text
			const hasLeadingSpace = text.startsWith(' ')
			const hasTrailingSpace = text.endsWith(' ')

			let isExtension = false

			// Handle tildes
			if (text.startsWith('~')) {
				isExtension = true
				text = text.substring(1) // Remove leading ~
			}

			if (text.includes('~')) {
				text = text.replace(/~/g, '')
			}

			const note: UltraStarNote = { type, startBeat, duration, pitch, text, isExtension }

			// Check if this note starts a new word
			// If text starts with space, it's a new word.
			// OR if previous note ended with space.
			// Exception: The very first note of a line starts a word regardless.
			if (hasLeadingSpace || previousNoteEndedWithSpace || (currentLine.words.length === 0 && currentWord.notes.length === 0)) {
				// If we have a current word with notes, push it to the line
				if (currentWord.notes.length > 0) {
					currentLine.words.push(currentWord)
				}
				// Start new word
				currentWord = { notes: [note] }
			} else {
				// Continuation of current word
				currentWord.notes.push(note)
			}

			previousNoteEndedWithSpace = hasTrailingSpace

			// Clean up the text for display (remove leading space if present)
			note.text = note.text.trim()

		} else if (line.startsWith('-')) {
			// Line break
			// Push the last word if exists
			if (currentWord.notes.length > 0) {
				currentLine.words.push(currentWord)
				currentWord = { notes: [] }
			}

			if (currentLine.words.length > 0) {
				lines.push(currentLine)
			}
			currentLine = { words: [], player: currentPlayer }
		} else if (line.startsWith('E')) {
			// End of song
			if (currentWord.notes.length > 0) {
				currentLine.words.push(currentWord)
				currentWord = { notes: [] }
			}
			if (currentLine.words.length > 0) {
				lines.push(currentLine)
			}
			currentLine = { words: [], player: currentPlayer } // Clear current line to avoid duplication
		}
	}

	// Handle case where file doesn't end with E or -
	if (currentWord.notes.length > 0) {
		currentLine.words.push(currentWord)
	}
	if (currentLine.words.length > 0) {
		lines.push(currentLine)
	}

	// Calculate absolute times
	const bpm = parseFloat(metadata['BPM']?.replace(',', '.') || '0')
	const gap = parseFloat(metadata['GAP']?.replace(',', '.') || '0')

	for (const line of lines) {
		let lineStart = Infinity
		let lineEnd = 0

		for (const word of line.words) {
			for (const note of word.notes) {
				const startBeat = note.startBeat
				const endBeat = startBeat + note.duration
				// Formula: time = (beat * 60) / (bpm * 4) + gap
				// Note: BPM in header is usually real_bpm * 4
				const startTime = (startBeat * 60) / (bpm * 4) + (gap / 1000)
				const endTime = (endBeat * 60) / (bpm * 4) + (gap / 1000)

				note.startTime = startTime
				note.endTime = endTime

				if (startTime < lineStart) lineStart = startTime
				if (endTime > lineEnd) lineEnd = endTime
			}
		}
		line.startTime = lineStart
		line.endTime = lineEnd
	}

	// Sort lines by start time to handle files where players are defined in blocks
	lines.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))

	return { metadata, lines }
}
