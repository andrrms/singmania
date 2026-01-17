/**
 * Shared pitch detection utilities
 */

export const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

/**
 * Implements the ACF2+ (Autocorrelation Function) algorithm for pitch detection
 * Optimized for human voice frequency range
 * 
 * @param buf - Float32Array of audio samples
 * @param sampleRate - Sample rate of the audio context
 * @returns Detected frequency in Hz, or -1 if no valid pitch detected
 */
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length
  let rms = 0

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i] || 0
    rms += val * val
  }
  rms = Math.sqrt(rms / SIZE)

  if (rms < 0.01) // Not enough signal
    return -1

  // Improved threshold detection for human voice
  // Use a slightly lower threshold to capture more of the waveform
  let r1 = 0, r2 = SIZE - 1
  const thres = 0.15
  for (let i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i] || 0) < thres) { r1 = i; break }
  for (let i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i] || 0) < thres) { r2 = SIZE - i; break }

  buf = buf.slice(r1, r2)
  SIZE = buf.length
  
  if (SIZE < 2) return -1

  const c = new Array(SIZE).fill(0)
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] = c[i] + (buf[j] || 0) * (buf[j + i] || 0)

  let d = 0; while (c[d] > c[d + 1]) d++
  let maxval = -1, maxpos = -1
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i]
      maxpos = i
    }
  }
  
  if (maxpos < 1 || maxpos >= SIZE - 1) return -1
  
  let T0 = maxpos

  // Safe to access directly since we checked bounds above
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  if (a) T0 = T0 - b / (2 * a)

  return sampleRate / T0
}

/**
 * Calculates RMS (Root Mean Square) volume from audio buffer
 * 
 * @param buf - Float32Array of audio samples
 * @returns RMS value (0 to ~1)
 */
export function calculateRMS(buf: Float32Array): number {
  let rms = 0
  for (let i = 0; i < buf.length; i++) {
    const val = buf[i] || 0
    rms += val * val
  }
  return Math.sqrt(rms / buf.length)
}

/**
 * Converts frequency to MIDI note number
 * 
 * @param freq - Frequency in Hz
 * @returns MIDI note number (fractional)
 */
export function frequencyToMidi(freq: number): number {
  return 12 * (Math.log(freq / 440) / Math.log(2)) + 69
}

/**
 * Gets the note name from a MIDI note number
 * 
 * @param midiNote - MIDI note number
 * @returns Note name (e.g., "C", "D#")
 */
export function midiToNoteName(midiNote: number): string {
  const roundedNote = Math.round(midiNote)
  return NOTE_STRINGS[((roundedNote % 12) + 12) % 12] || '-'
}
