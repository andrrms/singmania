<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useDraggable } from '@vueuse/core'
import type { UltraStarLine, UltraStarNote } from '~/utils/ultrastarParser'

const props = defineProps<{
  lines: UltraStarLine[]
  currentTime: number
  currentPitch: number | null
  windowDuration?: number // seconds to show
}>()

const WINDOW_DURATION = props.windowDuration || 4 // seconds
const PAST_BUFFER = 1 // seconds to keep showing after they pass

// Draggable logic
const el = ref<HTMLElement | null>(null)
const handle = ref<HTMLElement | null>(null)
const { x, y, style } = useDraggable(el, {
  initialValue: { x: 0, y: 0 },
  handle: handle
})

onMounted(() => {
  // Set initial position to top-right
  if (typeof window !== 'undefined') {
    x.value = window.innerWidth - 350 // ~320px width + margin
    y.value = 80 // Top margin
  }
})

// Note names for the sidebar (C to B)
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Flatten all notes for easier processing
const allNotes = computed(() => {
  const notes: (UltraStarNote & { id: string })[] = []
  let count = 0
  for (const line of props.lines) {
    for (const word of line.words) {
      for (const note of word.notes) {
        if (note.startTime !== undefined && note.endTime !== undefined) {
          notes.push({
            ...note,
            id: `note-${count++}`
          })
        }
      }
    }
  }
  return notes
})

// Calculate pitch range for brightness normalization
const minPitch = computed(() => allNotes.value.length ? Math.min(...allNotes.value.map(n => n.pitch)) : 0)
const maxPitch = computed(() => allNotes.value.length ? Math.max(...allNotes.value.map(n => n.pitch)) : 0)

// Filter visible notes
const visibleNotes = computed(() => {
  const start = props.currentTime - PAST_BUFFER
  const end = props.currentTime + WINDOW_DURATION
  
  return allNotes.value.filter(note => {
    const noteEnd = note.endTime!
    return noteEnd >= start && note.startTime! <= end
  })
})

// Map notes to style
const getNoteStyle = (note: UltraStarNote) => {
  const totalWindow = WINDOW_DURATION + PAST_BUFFER
  const relativeStart = note.startTime! - (props.currentTime - PAST_BUFFER)
  
  // Calculate left position as percentage
  const left = (relativeStart / totalWindow) * 100
  
  // Calculate width as percentage
  const duration = note.endTime! - note.startTime!
  const width = (duration / totalWindow) * 100
  
  // Y Position (Pitch)
  // Normalize pitch to 0-11 range (C to B)
  const normalizedPitch = ((note.pitch % 12) + 12) % 12
  
  // Map 0 (C) to bottom, 11 (B) to top
  const bottom = (normalizedPitch / 12) * 100
  const height = 100 / 12
  
  // Calculate brightness based on octave
  // Map pitch range to lightness 40% - 80%
  const range = maxPitch.value - minPitch.value || 1
  const normalizedRange = (note.pitch - minPitch.value) / range
  const lightness = 40 + (normalizedRange * 40)
  
  return {
    left: `${left}%`,
    width: `${Math.max(width, 1)}%`, // Ensure at least 1% width
    bottom: `${bottom}%`,
    height: `${height - 1}%`, // Slight gap between rows
    backgroundColor: `hsl(270, 70%, ${lightness}%)`,
    borderColor: `hsl(270, 70%, ${lightness + 10}%)`
  }
}

// User Pitch Indicator Style
const userPitchStyle = computed(() => {
  if (props.currentPitch === null) return { display: 'none' }
  
  // Normalize pitch to 0-11 range
  const normalizedPitch = ((props.currentPitch % 12) + 12) % 12
  const bottom = (normalizedPitch / 12) * 100
  
  return {
    bottom: `${bottom}%`,
    left: `${(PAST_BUFFER / (WINDOW_DURATION + PAST_BUFFER)) * 100}%`
  }
})
</script>

<template>
  <div ref="el" :style="style" class="fixed z-50 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-2xl w-80 h-64 transition-shadow duration-300 select-none resize overflow-auto min-w-[200px] min-h-[150px]">
    <!-- Header (Drag Handle) -->
    <div ref="handle" class="px-3 py-1.5 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0 cursor-move hover:bg-white/10 transition-colors">
      <span class="text-[10px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
        <Icon name="material-symbols:drag-indicator" class="w-3 h-3 opacity-50" />
        Pitch Timeline
      </span>
    </div>
    
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Note Names Sidebar -->
      <div class="w-8 flex flex-col-reverse border-r border-white/10 bg-white/5 shrink-0">
        <div v-for="(name, i) in noteNames" :key="i" 
          class="flex-1 flex items-center justify-center text-[9px] font-mono font-bold"
          :class="name.includes('#') ? 'text-white/30 bg-black/20' : 'text-white/60'">
          {{ name }}
        </div>
      </div>

      <!-- Timeline Area -->
      <div class="relative flex-1 w-full overflow-hidden bg-gradient-to-b from-black/20 to-black/40">
        <!-- Grid Lines (Horizontal for pitches) -->
        <div v-for="i in 12" :key="i" 
          class="absolute w-full border-b border-white/5"
          :class="{ 'bg-white/5': [2, 4, 7, 9, 11].includes(i) }" 
          :style="{ bottom: `${((i-1)/12)*100}%`, height: `${100/12}%` }">
        </div>
        
        <!-- Playhead Indicator (Vertical Line) -->
        <div class="absolute top-0 bottom-0 w-0.5 bg-white/50 z-20 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
             :style="{ left: `${(PAST_BUFFER / (WINDOW_DURATION + PAST_BUFFER)) * 100}%` }"></div>

        <!-- User Pitch Indicator (Arrow) -->
        <div class="absolute w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-l-yellow-400 z-30 transition-all duration-100 ease-out transform -translate-y-1/2 -translate-x-1"
             :style="userPitchStyle">
             <div class="w-3 h-3 bg-yellow-400 rotate-45 transform origin-center shadow-[0_0_10px_rgba(250,204,21,0.8)]"></div>
        </div>

        <!-- Notes -->
        <div v-for="note in visibleNotes" :key="note.id"
          class="absolute rounded-sm transition-all duration-75 border"
          :class="[
            note.startTime! <= currentTime && note.endTime! >= currentTime 
              ? 'shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10 brightness-150' 
              : 'opacity-80'
          ]"
          :style="getNoteStyle(note)"
        ></div>
      </div>
    </div>
  </div>
</template>

