import { ref, onUnmounted, computed } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'
import { autoCorrelate, calculateRMS, frequencyToMidi, midiToNoteName } from '~/utils/pitchUtils'

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
  const pitchBuffer: number[] = []
  const PITCH_BUFFER_SIZE = 3 // Number of samples for smoothing
  
  let animationId: number

  // Apply calibration offset to get the final pitch
  const pitch = computed(() => {
    if (rawPitch.value === null) return null
    const preferences = usePreferencesStore()
    // Apply calibration: if user sings flat, offset will be positive, so we add it to correct upward
    return rawPitch.value + preferences.pitchCalibrationOffset
  })

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
    
    // Calculate volume separately for UI feedback
    volume.value = calculateRMS(buf)
    
    const freq = autoCorrelate(buf, audioContext.value.sampleRate)

    if (freq !== -1 && freq > 50 && freq < 2000) { // Valid frequency range for human voice (50Hz - 2000Hz)
      const noteNum = frequencyToMidi(freq)
      
      // Apply smoothing to reduce jitter
      const smoothedNote = getSmoothedPitch(noteNum)
      const roundedNote = Math.round(smoothedNote)
      
      rawPitch.value = smoothedNote
      note.value = midiToNoteName(smoothedNote)
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
