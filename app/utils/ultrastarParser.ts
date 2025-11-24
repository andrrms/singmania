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

export const stringifyUltraStar = (song: UltraStarSong): string => {
	let output = ''

	// Metadata
	for (const [key, value] of Object.entries(song.metadata)) {
		output += `#${key}:${value}\n`
	}

	// Lines
	for (const line of song.lines) {
		// Check if we need to switch player (for duets, though currently we focus on solo)
		// if (line.player) output += `P${line.player}\n` 

		for (let i = 0; i < line.words.length; i++) {
			const word = line.words[i]
			for (let j = 0; j < word.notes.length; j++) {
				const note = word.notes[j]
				let text = note.text
				
				// Add space at the end if it's the last note of the word
				// AND it's not the very last word of the line (though usually lines end with space too in some editors, but standard is space between words)
				if (j === word.notes.length - 1) {
					text += ' '
				}

				// Handle extension/tilde
				if (note.isExtension) {
					// Usually extensions are marked with ~ at start of text in some editors or just handled by type
					// But in standard UltraStar, type is enough? 
					// Actually, standard is: if it's a continuation, it might be type * or just text starting with ~
					// Let's stick to the standard format:
					// : 10 2 10 word 
					// : 12 2 10 ~
					// or
					// : 12 2 10 ~ord (if split inside word)
					
					// My parser handles `~` removal. So we might need to add it back if it's a split syllable?
					// But `isExtension` flag in my parser comes from `text.startsWith('~')`.
					// So if we want to reconstruct, we should probably check that.
					// However, for simplicity, let's assume `text` holds the content.
				}
				
				// If note type is not one of the standard ones, default to ':'
				const type = note.type || ':'
				output += `${type} ${note.startBeat} ${note.duration} ${note.pitch} ${text}\n`
			}
		}
		// Line break
		// We need to calculate where the line break happens. 
		// Usually it's after the last note of the line.
		// The beat for the line break is usually the end beat of the last note, or slightly after.
		// Let's use the end beat of the last note of the last word.
		if (line.words.length > 0) {
			const lastWord = line.words[line.words.length - 1]
			if (lastWord.notes.length > 0) {
				const lastNote = lastWord.notes[lastWord.notes.length - 1]
				const endBeat = lastNote.startBeat + lastNote.duration
				output += `- ${endBeat}\n`
			}
		}
	}

	output += 'E\n'
	return output
}
