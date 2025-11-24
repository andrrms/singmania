import { ref, computed, watch, reactive, type Ref } from 'vue'
import type { UltraStarLine, UltraStarNote } from '~/utils/ultrastarParser'
import type { NoteStats } from '~/utils/db'

interface NoteState {
  sungDuration: number
  isScored: boolean
  maxScore: number
}

export interface Feedback {
  text: string
  type: 'ok' | 'good' | 'excellent' | 'perfect'
  count: number
}

export function useScoring(
  lines: UltraStarLine[],
  currentTime: Ref<number>,
  detectedPitch: Ref<number | null>,
  difficulty: Ref<string>,
  isPlaying: Ref<boolean>,
  selectedPlayer: Ref<number | undefined>
) {
  const score = ref(0)
  const totalMaxScore = ref(0)
  const currentMaxScore = ref(0) // Max score possible for notes that have finished
  const goldenNoteHit = ref(false)
  const lastFeedback = ref<Feedback | null>(null)
  const noteStats = reactive<NoteStats>({ ok: 0, good: 0, excellent: 0, perfect: 0 })

  // State for each note
  const noteStates = reactive(new Map<UltraStarNote, NoteState>())

  const allNotes = computed(() => {
    const notes: UltraStarNote[] = []
    for (const line of lines) {
      // Filter by player if selected
      if (selectedPlayer.value !== undefined && line.player !== undefined && line.player !== selectedPlayer.value) {
        continue
      }

      for (const word of line.words) {
        for (const note of word.notes) {
          if (note.startTime !== undefined && note.endTime !== undefined) {
            notes.push(note)
          }
        }
      }
    }
    return notes.sort((a, b) => a.startTime! - b.startTime!)
  })

  const totalNotes = computed(() => allNotes.value.length)

  // Difficulty settings
  const settings = computed(() => {
    // Default: Normal
    let points = 20
    let pitchTol = 1
    let thresholds = { ok: 0.25, good: 0.5, excellent: 0.75 }

    switch (difficulty.value) {
      case 'Freestyle':
        points = 0
        pitchTol = 0
        thresholds = { ok: 1, good: 1, excellent: 1 } // Impossible to score
        break
      case 'Fácil':
        points = 10
        pitchTol = 2
        thresholds = { ok: 0.2, good: 0.4, excellent: 0.6 }
        break
      case 'SingStar!': // Hardest
      case 'Difícil':
        points = 30
        pitchTol = 0.5
        thresholds = { ok: 0.4, good: 0.6, excellent: 0.85 }
        break
      case 'Normal':
      default:
        points = 20
        pitchTol = 1
        thresholds = { ok: 0.25, good: 0.5, excellent: 0.75 }
        break
    }
    return { points, pitchTol, thresholds }
  })

  // Initialize and calculate total max score
  const calculateTotalMaxScore = () => {
    let total = 0
    const { points } = settings.value

    if (difficulty.value === 'Freestyle') {
      totalMaxScore.value = 0
      return
    }

    for (const note of allNotes.value) {
      const isGolden = (note.type === '*' || note.type === 'G')
      const multiplier = isGolden ? 2 : 1
      const noteScore = points * multiplier
      total += noteScore

      // Initialize state if not exists
      if (!noteStates.has(note)) {
        noteStates.set(note, {
          sungDuration: 0,
          isScored: false,
          maxScore: noteScore
        })
      } else {
        // Update maxScore in state if difficulty changed
        const state = noteStates.get(note)!
        state.maxScore = noteScore
      }
    }
    totalMaxScore.value = total
  }

  // Watchers
  watch([allNotes, difficulty], () => {
    calculateTotalMaxScore()
  }, { immediate: true })

  let lastTime = 0
  let feedbackTimeout: any = null

  watch(currentTime, (newTime) => {
    if (!isPlaying.value) {
      lastTime = newTime
      return
    }

    const dt = newTime - lastTime
    lastTime = newTime

    if (dt <= 0) return

    // Trailing window to allow catching the end of the note
    const TRAILING_WINDOW = 0.15

    for (const note of allNotes.value) {
      const state = noteStates.get(note)
      if (!state || state.isScored) continue

      const noteEnd = note.endTime!
      const noteStart = note.startTime!
      const noteDuration = noteEnd - noteStart

      // 1. Check if we are currently singing this note (with tolerance)
      if (newTime >= noteStart && newTime <= noteEnd + TRAILING_WINDOW) {
        if (detectedPitch.value !== null) {
          const isFreestyle = (note.type === 'F')
          let hit = false

          if (isFreestyle || difficulty.value === 'Freestyle') {
            hit = true
          } else {
            const pitchDiff = Math.abs(detectedPitch.value - note.pitch)
            const octaveDiff = Math.abs(pitchDiff % 12)
            const normalizedDiff = Math.min(octaveDiff, 12 - octaveDiff)
            if (normalizedDiff <= settings.value.pitchTol) {
              hit = true
            }
          }

          if (hit) {
            // Accumulate duration, capped at note duration
            if (state.sungDuration < noteDuration) {
              state.sungDuration = Math.min(state.sungDuration + dt, noteDuration)
            }
          }
        }
      }

      // 2. Check if note is finished (time passed beyond window)
      if (newTime > noteEnd + TRAILING_WINDOW) {
        scoreNote(note, state)
      }
    }
  })

  const scoreNote = (note: UltraStarNote, state: NoteState) => {
    if (state.isScored) return

    if (difficulty.value === 'Freestyle') {
      state.isScored = true
      return
    }

    const noteDuration = note.endTime! - note.startTime!
    // Avoid division by zero
    const duration = noteDuration > 0 ? noteDuration : 0.1
    const percent = state.sungDuration / duration

    const { thresholds, points } = settings.value
    const isGolden = (note.type === '*' || note.type === 'G')

    let earned = 0
    let feedbackType: Feedback['type'] | null = null

    if (percent >= thresholds.excellent) {
      if (isGolden) {
        earned = points * 2
        feedbackType = 'perfect'
        noteStats.perfect++
        // Trigger Golden Note Visual
        if (!goldenNoteHit.value) {
          goldenNoteHit.value = true
          setTimeout(() => goldenNoteHit.value = false, 500)
        }
      } else {
        earned = points
        feedbackType = 'excellent'
        noteStats.excellent++
      }
    } else if (percent >= thresholds.good) {
      earned = Math.floor(points * (2 / 3))
      feedbackType = 'good'
      noteStats.good++
    } else if (percent >= thresholds.ok) {
      earned = Math.floor(points * (1 / 3))
      feedbackType = 'ok'
      noteStats.ok++
    }

    if (feedbackType) {
      score.value += earned
      lastFeedback.value = {
        text: feedbackType === 'perfect' ? 'Perfeito!' : feedbackType === 'excellent' ? 'Excelente' : feedbackType === 'good' ? 'Bom' : 'Ok',
        type: feedbackType,
        count: (lastFeedback.value?.count || 0) + 1
      }

      if (feedbackTimeout) clearTimeout(feedbackTimeout)
      feedbackTimeout = setTimeout(() => {
        lastFeedback.value = null
      }, 1000)
    }

    currentMaxScore.value += state.maxScore
    state.isScored = true
  }

  const resetScore = () => {
    score.value = 0
    currentMaxScore.value = 0
    lastTime = 0
    goldenNoteHit.value = false
    lastFeedback.value = null
    noteStats.ok = 0
    noteStats.good = 0
    noteStats.excellent = 0
    noteStats.perfect = 0
    for (const state of noteStates.values()) {
      state.sungDuration = 0
      state.isScored = false
    }
  }

  const rating = computed(() => {
    if (difficulty.value === 'Freestyle') return 'Freestyle'
    if (totalMaxScore.value === 0) return 'Vamos lá!'
    if (currentMaxScore.value === 0) return 'Preparar...'

    const percentage = score.value / currentMaxScore.value

    if (percentage >= 0.9) return 'SingStar!'
    if (percentage > 0.8) return 'Excelente!'
    if (percentage > 0.6) return 'Ótimo!'
    if (percentage > 0.4) return 'Bom'
    if (percentage > 0.2) return 'Ok'
    return 'Melhore...'
  })

  return {
    score,
    totalMaxScore,
    rating,
    resetScore,
    goldenNoteHit,
    lastFeedback,
    noteStats,
    totalNotes,
    // New stats
    totalGoldenNotes: computed(() => allNotes.value.filter(n => n.type === '*' || n.type === 'G').length),
    goldenNotesHit: computed(() => noteStats.perfect) // Assuming perfect = golden hit based on logic above, but let's be more precise if needed. 
    // Actually, looking at logic: if (isGolden) { ... noteStats.perfect++ }
    // So noteStats.perfect IS the count of golden notes hit (since only golden notes give perfect feedback in this logic? 
    // Wait, let's check lines 204-218 in original file.
    // if (percent >= thresholds.excellent) { if (isGolden) { ... feedbackType='perfect' ... } else { ... feedbackType='excellent' ... } }
    // Yes, 'perfect' feedback is EXCLUSIVE to golden notes in the current logic.
    // So noteStats.perfect is accurate for golden notes hit.
  }
}
