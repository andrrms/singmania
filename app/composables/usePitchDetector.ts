import { ref, onUnmounted, computed } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'

export function usePitchDetector() {
  const audioContext = ref<AudioContext | null>(null)
  const analyser = ref<AnalyserNode | null>(null)
  const microphone = ref<MediaStreamAudioSourceNode | null>(null)
  const gainNode = ref<GainNode | null>(null)
  const mediaStream = ref<MediaStream | null>(null)
  
  const rawPitch = ref<number | null>(null) // Raw MIDI note number before calibration
  const note = ref<string>('-') // Note name (C, D#, etc)
  const cents = ref<number>(0) // Detune
  const volume = ref<number>(0)
  
  // Instance-specific smoothing buffer for pitch stability
  let pitchBuffer: number[] = []
  const PITCH_BUFFER_SIZE = 3 // Number of samples for smoothing
  
  let animationId: number

  const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

  // Apply calibration offset to get the final pitch
  const pitch = computed(() => {
    if (rawPitch.value === null) return null
    const preferences = usePreferencesStore()
    // Apply calibration: if user sings flat, offset will be positive, so we add it to correct upward
    return rawPitch.value + preferences.pitchCalibrationOffset
  })

  const autoCorrelate = (buf: Float32Array, sampleRate: number) => {
    // Implements the ACF2+ algorithm with improvements for human voice
    let SIZE = buf.length
    let rms = 0

    for (let i = 0; i < SIZE; i++) {
      const val = buf[i] || 0
      rms += val * val
    }
    rms = Math.sqrt(rms / SIZE)
    volume.value = rms

    if (rms < 0.01) // Not enough signal
      return -1

    // Improved threshold detection for human voice
    // Use a slightly lower threshold to capture more of the waveform
    let r1 = 0, r2 = SIZE - 1
    const thres = 0.15
    for (let i = 0; i < SIZE / 2; i++)
      if (Math.abs(buf[i] || 0) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++)
      if (Math.abs(buf[SIZE - i] || 0) < thres) { r2 = SIZE - i; break; }

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

  // Median filter for pitch smoothing (reduces octave jumping)
  const getSmoothedPitch = (newPitch: number): number => {
    pitchBuffer.push(newPitch)
    if (pitchBuffer.length > PITCH_BUFFER_SIZE) {
      pitchBuffer.shift()
    }
    
    if (pitchBuffer.length < 2) return newPitch
    
    // Use middle value (not averaged) to reject outliers (octave jumps)
    const sorted = [...pitchBuffer].sort((a, b) => a - b)
    const mid = Math.floor((sorted.length - 1) / 2)
    return sorted[mid]
  }

  const updatePitch = () => {
    if (!analyser.value || !audioContext.value) return
    
    const buf = new Float32Array(2048)
    analyser.value.getFloatTimeDomainData(buf)
    const ac = autoCorrelate(buf, audioContext.value.sampleRate)

    if (ac !== -1 && ac > 50 && ac < 2000) { // Valid frequency range for human voice (50Hz - 2000Hz)
      const noteNum = 12 * (Math.log(ac / 440) / Math.log(2)) + 69
      
      // Apply smoothing to reduce jitter
      const smoothedNote = getSmoothedPitch(noteNum)
      const roundedNote = Math.round(smoothedNote)
      
      rawPitch.value = smoothedNote
      note.value = noteStrings[((roundedNote % 12) + 12) % 12] || '-'
      cents.value = Math.floor((smoothedNote - roundedNote) * 100)
    } else {
      // Clear buffer when no signal to prevent stale data
      pitchBuffer.length = 0
      rawPitch.value = null
    }

    animationId = requestAnimationFrame(updatePitch)
  }

  const start = async () => {
    try {
      const preferences = usePreferencesStore()
      audioContext.value = new window.AudioContext()
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          deviceId: preferences.inputDeviceId !== 'default' ? { exact: preferences.inputDeviceId } : undefined
        }
      }

      mediaStream.value = await navigator.mediaDevices.getUserMedia(constraints)
      microphone.value = audioContext.value.createMediaStreamSource(mediaStream.value)
      
      gainNode.value = audioContext.value.createGain()
      gainNode.value.gain.value = preferences.inputGain

      analyser.value = audioContext.value.createAnalyser()
      analyser.value.fftSize = 2048
      
      microphone.value.connect(gainNode.value)
      gainNode.value.connect(analyser.value)
      
      updatePitch()
    } catch (e) {
      console.error('Error accessing microphone', e)
    }
  }

  const stop = () => {
    if (animationId) cancelAnimationFrame(animationId)
    if (microphone.value) microphone.value.disconnect()
    if (gainNode.value) gainNode.value.disconnect()
    if (analyser.value) analyser.value.disconnect()
    if (mediaStream.value) mediaStream.value.getTracks().forEach(t => t.stop())
    if (audioContext.value) audioContext.value.close()
    
    rawPitch.value = null
    note.value = '-'
    pitchBuffer.length = 0
  }

  onUnmounted(() => {
    stop()
  })

  return {
    start,
    stop,
    pitch,
    rawPitch, // Expose raw pitch for calibration purposes
    note,
    volume,
    cents
  }
}
