<script setup lang="ts">
const props = defineProps<{
  show: boolean
  backgroundDim: number
  lyricsScale: number
  globalOffset: number
  debugMode: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:backgroundDim', value: number): void
  (e: 'update:lyricsScale', value: number): void
  (e: 'update:globalOffset', value: number): void
  (e: 'reset'): void
  (e: 'save'): void
  (e: 'update:debugMode', value: boolean): void
}>()
</script>

<template>
  <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-x-4"
    enter-to-class="opacity-100 translate-x-0" leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 translate-x-4">
    <div v-if="show"
      class="absolute top-24 right-8 z-50 bg-zinc-900/95 backdrop-blur-xl p-6 rounded-2xl text-white w-80 border border-white/10 pointer-events-auto shadow-2xl flex flex-col gap-6">

      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <Icon name="material-symbols:settings-rounded" class="w-5 h-5 text-violet-400" />
          Configurações
        </h3>
        <button @click="emit('close')" class="text-white/40 hover:text-white transition-colors">
          <Icon name="material-symbols:close-rounded" class="w-5 h-5" />
        </button>
      </div>

      <!-- Debug Mode -->
      <div class="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/5">
        <span class="text-sm font-medium text-gray-300">Modo Debug</span>
        <button @click="emit('update:debugMode', !debugMode)" class="w-10 h-6 rounded-full transition-colors relative"
          :class="debugMode ? 'bg-violet-500' : 'bg-white/20'">
          <div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
            :class="debugMode ? 'translate-x-4' : 'translate-x-0'"></div>
        </button>
      </div>

      <!-- Visual Settings -->
      <div class="space-y-3 border-t border-white/10 pt-3">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium text-gray-300">Escurecer Fundo</span>
          <span class="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
            {{ Math.round(backgroundDim * 100) }}%
          </span>
        </div>
        <input type="range" min="0" max="1" step="0.05" :value="backgroundDim"
          @input="emit('update:backgroundDim', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />

        <div class="flex justify-between items-center mt-2">
          <span class="text-sm font-medium text-gray-300">Tamanho da Letra</span>
          <span class="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
            {{ Number(lyricsScale).toFixed(1) }}x
          </span>
        </div>
        <input type="range" min="0.5" max="2" step="0.1" :value="lyricsScale"
          @input="emit('update:lyricsScale', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
      </div>

      <!-- Offset Control -->
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium text-gray-300">Sincronia Áudio/Letra</span>
          <span class="font-mono font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">
            {{ globalOffset > 0 ? '+' : '' }}{{ globalOffset.toFixed(2) }}s
          </span>
        </div>

        <div class="grid grid-cols-4 gap-2">
          <button @click="emit('update:globalOffset', globalOffset - 0.5)"
            class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5"
            title="-0.5s">&lt;&lt;</button>
          <button @click="emit('update:globalOffset', globalOffset - 0.1)"
            class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5"
            title="-0.1s">&lt;</button>
          <button @click="emit('update:globalOffset', globalOffset + 0.1)"
            class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5"
            title="+0.1s">&gt;</button>
          <button @click="emit('update:globalOffset', globalOffset + 0.5)"
            class="bg-white/5 hover:bg-white/10 active:bg-white/20 rounded p-2 text-xs font-bold transition-colors border border-white/5"
            title="+0.5s">&gt;&gt;</button>
        </div>
      </div>

      <!-- Actions -->
      <div class="grid grid-cols-2 gap-3 pt-2">
        <button @click="emit('reset')"
          class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-bold transition-all border border-white/5">
          Resetar
        </button>
        <button @click="emit('save')"
          class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2">
          <Icon name="material-symbols:save-rounded" class="w-4 h-4" />
          Salvar
        </button>
      </div>
    </div>
  </transition>
</template>
