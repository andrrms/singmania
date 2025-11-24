<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'

const preferences = usePreferencesStore()
const devices = ref<MediaDeviceInfo[]>([])
const isTesting = ref(false)
const audioLevel = ref(0) // 0-100

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaStreamAudioSourceNode | null = null
let gainNode: GainNode | null = null
let stream: MediaStream | null = null
let animationFrame: number

const getDevices = async () => {
  try {
    // Ensure we have permission first (usually handled by parent, but enumerateDevices needs it for labels)
    const allDevices = await navigator.mediaDevices.enumerateDevices()
    devices.value = allDevices.filter(d => d.kind === 'audioinput')
    
    // If current device is not in list (and not default), reset to default
    if (preferences.inputDeviceId !== 'default' && !devices.value.find(d => d.deviceId === preferences.inputDeviceId)) {
        preferences.inputDeviceId = 'default'
    }
  } catch (e) {
    console.error('Error enumerating devices', e)
  }
}

const startStream = async () => {
  stopStream()
  try {
    audioContext = new window.AudioContext()
    const constraints: MediaStreamConstraints = {
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            deviceId: preferences.inputDeviceId !== 'default' ? { exact: preferences.inputDeviceId } : undefined
        }
    }
    stream = await navigator.mediaDevices.getUserMedia(constraints)
    source = audioContext.createMediaStreamSource(stream)
    gainNode = audioContext.createGain()
    gainNode.gain.value = preferences.inputGain
    
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.5
    
    source.connect(gainNode)
    gainNode.connect(analyser)
    
    if (isTesting.value) {
        gainNode.connect(audioContext.destination)
    }
    
    updateLevel()
  } catch (e) {
    console.error('Error starting stream', e)
  }
}

const stopStream = () => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (source) source.disconnect()
  if (gainNode) gainNode.disconnect()
  if (analyser) analyser.disconnect()
  if (stream) stream.getTracks().forEach(t => t.stop())
  if (audioContext) audioContext.close()
  
  source = null
  gainNode = null
  analyser = null
  stream = null
  audioContext = null
  audioLevel.value = 0
}

const updateLevel = () => {
    if (!analyser) return
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    
    // Calculate RMS or Peak
    let sum = 0
    for(let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
    }
    const average = sum / dataArray.length
    
    // Scale to 0-100. Average is usually low (0-128 mostly).
    // Let's boost it a bit for visibility
    const normalized = Math.min(100, (average / 64) * 100)
    audioLevel.value = normalized
    
    animationFrame = requestAnimationFrame(updateLevel)
}

const toggleTest = () => {
    isTesting.value = !isTesting.value
    if (!audioContext || !gainNode) return
    
    if (isTesting.value) {
        gainNode.connect(audioContext.destination)
    } else {
        try {
            gainNode.disconnect(audioContext.destination)
        } catch (e) {
            // Fallback if specific disconnect is not supported or fails
            // Reconnect everything
            gainNode.disconnect()
            if (analyser) gainNode.connect(analyser)
        }
    }
}

// Watchers
watch(() => preferences.inputDeviceId, () => {
    startStream()
})

watch(() => preferences.inputGain, (newGain) => {
    if (gainNode) {
        gainNode.gain.value = newGain
    }
})

onMounted(async () => {
    await getDevices()
    startStream()
    
    navigator.mediaDevices.addEventListener('devicechange', getDevices)
})

onUnmounted(() => {
    stopStream()
    navigator.mediaDevices.removeEventListener('devicechange', getDevices)
})
</script>

<template>
    <div class="bg-white/5 p-6 rounded-2xl border border-white/10 w-full hover:border-white/20 transition-colors">
        <div class="flex items-center gap-2 text-white/60 mb-6">
            <Icon name="material-symbols:mic-rounded" class="w-5 h-5" />
            <p class="text-sm font-bold uppercase tracking-widest">Configuração de Áudio</p>
        </div>
        
        <div class="space-y-6">
            <!-- Device Select -->
            <div class="space-y-2 text-left">
                <label class="text-xs font-bold text-white/40 uppercase tracking-wider block">Microfone</label>
                <div class="relative">
                    <select v-model="preferences.inputDeviceId" 
                        class="w-full bg-black/20 border border-white/10 rounded-lg pl-3 pr-8 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer">
                        <option value="default">Padrão do Sistema</option>
                        <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
                            {{ device.label || `Microfone (${device.deviceId.slice(0, 8)}...)` }}
                        </option>
                    </select>
                    <Icon name="material-symbols:keyboard-arrow-down-rounded" class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </div>
            </div>
            
            <!-- Gain Slider -->
            <div class="space-y-3">
                <div class="flex justify-between items-end">
                    <label class="text-xs font-bold text-white/40 uppercase tracking-wider">Ganho / Volume</label>
                    <span class="text-xs font-mono font-bold text-violet-300">{{ (preferences.inputGain * 100).toFixed(0) }}%</span>
                </div>
                <input type="range" v-model.number="preferences.inputGain" min="0" max="3" step="0.1"
                    class="w-full accent-violet-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-colors" />
            </div>
            
            <!-- Level Meter & Test -->
            <div class="space-y-3 pt-2">
                 <div class="flex justify-between items-center">
                    <label class="text-xs font-bold text-white/40 uppercase tracking-wider">Nível de Entrada</label>
                    <button @click="toggleTest" 
                        class="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all flex items-center gap-2"
                        :class="isTesting ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5 hover:border-white/10'">
                        <Icon :name="isTesting ? 'material-symbols:volume-off-rounded' : 'material-symbols:volume-up-rounded'" class="w-4 h-4" />
                        {{ isTesting ? 'Parar Retorno' : 'Testar Retorno' }}
                    </button>
                 </div>
                 
                 <div class="h-3 bg-black/40 rounded-full overflow-hidden relative shadow-inner">
                    <!-- The Bar -->
                    <div class="h-full transition-all duration-100 ease-out bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500"
                        :style="{ width: `${audioLevel}%` }">
                    </div>
                 </div>
            </div>
        </div>
    </div>
</template>
