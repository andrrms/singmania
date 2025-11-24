import { ref, onMounted, onUnmounted } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'

export function usePitchDetector() {
  const audioContext = ref<AudioContext | null>(null)
  const analyser = ref<AnalyserNode | null>(null)
  const microphone = ref<MediaStreamAudioSourceNode | null>(null)
  const gainNode = ref<GainNode | null>(null)
  const mediaStream = ref<MediaStream | null>(null)
  
  const pitch = ref<number | null>(null) // MIDI note number
  const note = ref<string>('-') // Note name (C, D#, etc)
  const cents = ref<number>(0) // Detune
  const volume = ref<number>(0)
  
  let animationId: number

  const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

  const autoCorrelate = (buf: Float32Array, sampleRate: number) => {
    // Implements the ACF2+ algorithm
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

    let r1 = 0, r2 = SIZE - 1, thres = 0.2
    for (let i = 0; i < SIZE / 2; i++)
      if (Math.abs(buf[i] || 0) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++)
      if (Math.abs(buf[SIZE - i] || 0) < thres) { r2 = SIZE - i; break; }

    buf = buf.slice(r1, r2)
    SIZE = buf.length

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
    let T0 = maxpos

    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]
    const a = (x1 + x3 - 2 * x2) / 2
    const b = (x3 - x1) / 2
    if (a) T0 = T0 - b / (2 * a)

    return sampleRate / T0
  }

  const updatePitch = () => {
    if (!analyser.value || !audioContext.value) return
    
    const buf = new Float32Array(2048)
    analyser.value.getFloatTimeDomainData(buf)
    const ac = autoCorrelate(buf, audioContext.value.sampleRate)

    if (ac !== -1) {
      const noteNum = 12 * (Math.log(ac / 440) / Math.log(2)) + 69
      const roundedNote = Math.round(noteNum)
      
      // Smoothing: Simple moving average could be added here if needed
      // For now, we just update directly but we could lerp
      pitch.value = noteNum
      note.value = noteStrings[roundedNote % 12] || '-'
      cents.value = Math.floor((noteNum - roundedNote) * 100)
    } else {
      // Keep last pitch or reset? 
      // Resetting makes the arrow disappear or drop. 
      // Let's set to null to indicate silence
      pitch.value = null
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
    
    pitch.value = null
    note.value = '-'
  }

  onUnmounted(() => {
    stop()
  })

  return {
    start,
    stop,
    pitch,
    note,
    volume
  }
}
