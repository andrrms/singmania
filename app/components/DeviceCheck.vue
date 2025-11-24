<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMobile = ref(false)
const showBrowserWarning = ref(false)
const dismissed = ref(false)

onMounted(() => {
  const ua = navigator.userAgent.toLowerCase()
  
  // Mobile Detection
  isMobile.value = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  
  if (!isMobile.value) {
    // Browser Detection
    const isFirefox = ua.indexOf('firefox') > -1
    const isEdge = ua.indexOf('edg') > -1
    // Chrome includes 'chrome' but Edge also includes 'chrome'. 
    // So if it has chrome and is not edge, it's likely Chrome (or Opera, Brave, etc which are Chromium based and usually fine)
    // But strictly speaking, if we want to warn for Safari or plain IE (lol):
    const isChrome = ua.indexOf('chrome') > -1 && !isEdge
    
    // If it's not one of the "approved" ones
    if (!isFirefox && !isEdge && !isChrome) {
      showBrowserWarning.value = true
    }
  }
})

const dismissWarning = () => {
  dismissed.value = true
}
</script>

<template>
  <div class="relative z-[9999]">
    <!-- Mobile Block Screen -->
    <div v-if="isMobile" class="fixed inset-0 bg-black z-[10000] flex flex-col items-center justify-center p-8 text-center">
      <div class="max-w-md space-y-8">
        <div class="relative mx-auto w-32 h-32">
           <div class="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse"></div>
           <Icon name="material-symbols:phonelink-off-rounded" class="w-32 h-32 text-white relative z-10" />
        </div>
        
        <div class="space-y-4">
          <h1 class="text-3xl font-black text-white uppercase tracking-tighter">Apenas Computador</h1>
          <p class="text-white/60 text-lg leading-relaxed">
            O SingMania foi desenhado para oferecer a melhor experiência de karaokê em telas grandes.
            <br/><br/>
            Por favor, acesse através de um computador para começar o show!
          </p>
        </div>
      </div>
    </div>

    <!-- Browser Warning Screen -->
    <div v-if="showBrowserWarning && !dismissed" class="fixed inset-0 bg-black/95 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center p-8 text-center">
      <div class="max-w-2xl space-y-10 bg-white/5 p-10 rounded-3xl border border-white/10 shadow-2xl">
        <div class="space-y-4">
          <div class="inline-flex items-center justify-center p-4 rounded-full bg-yellow-500/20 text-yellow-400 mb-4">
             <Icon name="material-symbols:warning-rounded" class="w-12 h-12" />
          </div>
          <h1 class="text-3xl font-black text-white uppercase tracking-tighter">Navegador Não Recomendado</h1>
          <p class="text-white/70 text-lg leading-relaxed max-w-lg mx-auto">
            Detectamos que você não está usando um navegador otimizado para o SingMania. 
            Para evitar travamentos e garantir a sincronia perfeita do áudio, recomendamos fortemente o uso de um dos seguintes navegadores:
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Chrome -->
          <a href="https://www.google.com/chrome/" target="_blank" class="group flex flex-col items-center gap-4 p-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1">
            <Icon name="logos:chrome" class="w-12 h-12 filter grayscale group-hover:grayscale-0 transition-all" />
            <div class="space-y-1">
              <span class="block font-bold text-white">Google Chrome</span>
              <span class="block text-xs text-violet-400 font-bold uppercase tracking-wider">Recomendado</span>
            </div>
          </a>

          <!-- Edge -->
          <a href="https://www.microsoft.com/edge" target="_blank" class="group flex flex-col items-center gap-4 p-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1">
            <Icon name="logos:microsoft-edge" class="w-12 h-12 filter grayscale group-hover:grayscale-0 transition-all" />
            <div class="space-y-1">
              <span class="block font-bold text-white">Microsoft Edge</span>
              <span class="block text-xs text-white/40 font-bold uppercase tracking-wider">Compatível</span>
            </div>
          </a>

          <!-- Firefox -->
          <a href="https://www.mozilla.org/firefox/new/" target="_blank" class="group flex flex-col items-center gap-4 p-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1">
            <Icon name="logos:firefox" class="w-12 h-12 filter grayscale group-hover:grayscale-0 transition-all" />
            <div class="space-y-1">
              <span class="block font-bold text-white">Firefox</span>
              <span class="block text-xs text-white/40 font-bold uppercase tracking-wider">Compatível</span>
            </div>
          </a>
        </div>

        <div class="pt-4">
          <button @click="dismissWarning" class="text-white/40 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors border-b border-transparent hover:border-white/40 pb-1">
            Entendo os riscos, continuar mesmo assim
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
