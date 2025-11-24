<script setup lang="ts">
import { useLibrary } from '~/composables/useLibrary'
import type { SavedSong } from '~/utils/db'
import { watch, nextTick } from 'vue'

const props = defineProps<{
  highlightId?: number
}>()

const emit = defineEmits<{
  (e: 'select', song: SavedSong): void
}>()

const {
  savedSongs,
  isLoadingLibrary,
  searchQuery,
  sortOrder,
  filterType,
  filteredSongs,
  removeSong,
  clearCache,
  isDuet,
  refreshSongs
} = useLibrary()

// Watch for highlightId changes to scroll into view
watch(() => props.highlightId, async (newId) => {
  if (newId) {
    // Ensure the list is updated (if we just added it)
    await nextTick()
    const el = document.getElementById(`song-${newId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Optional: Add a temporary flash effect class logic here if needed, 
      // but CSS animation on the element based on ID match is easier.
    }
  }
})

defineExpose({
  refreshSongs,
  songs: savedSongs
})
</script>

<template>
  <div class="h-full flex flex-col relative z-10">
    <div class="flex flex-col gap-4 mb-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <ClientOnly>
            <Icon name="material-symbols:library-music-rounded" class="text-violet-400" />
          </ClientOnly>
          Sua Biblioteca
        </h2>
        <button v-if="savedSongs.length > 0" @click="clearCache"
          class="text-xs text-red-400 hover:text-red-300 uppercase tracking-wider font-bold border border-red-500/30 px-3 py-1 rounded hover:bg-red-500/10 transition-colors flex items-center gap-1">
          <ClientOnly>
            <Icon name="material-symbols:delete-outline" />
          </ClientOnly>
          Limpar Cache
        </button>
      </div>

      <!-- Search and Filters -->
      <div class="flex flex-col md:flex-row gap-3">
        <div class="relative flex-1">
          <ClientOnly>
            <Icon name="material-symbols:search" class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          </ClientOnly>
          <input v-model="searchQuery" type="text" placeholder="Buscar música ou artista..."
            class="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all" />
        </div>
        <div class="flex gap-2">
          <select v-model="filterType"
            class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
            <option value="all">Todos</option>
            <option value="duet">Duetos</option>
            <option value="solo">Solo</option>
            <option value="played">Já Cantadas</option>
            <option value="unplayed">Não Cantadas</option>
          </select>
          <select v-model="sortOrder"
            class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
            <option value="added">Recentes</option>
            <option value="title">Título</option>
            <option value="artist">Artista</option>
            <option value="score">Pontuação</option>
            <option value="rank">Rank</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingLibrary" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      <div v-for="i in 4" :key="i" class="h-32 bg-white/5 rounded-xl border border-white/5"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredSongs.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-white/30 border-2 border-dashed border-white/10 rounded-3xl p-12">
      <ClientOnly>
        <Icon name="material-symbols:music-off-rounded" class="w-16 h-16 mb-4 opacity-50" />
      </ClientOnly>
      <p class="text-lg font-medium">Nenhuma música encontrada</p>
      <p class="text-sm" v-if="savedSongs.length === 0">Suas músicas carregadas aparecerão aqui.</p>
      <p class="text-sm" v-else>Tente ajustar seus filtros de busca.</p>
    </div>

    <!-- List -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto p-1 pb-20 custom-scrollbar">
      <div v-for="(song, index) in filteredSongs" :key="song.id" :id="`song-${song.id}`"
        class="group relative bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between h-32"
        :class="{ 'ring-2 ring-violet-500 bg-violet-500/10': highlightId === song.id }" @click="emit('select', song)">

        <!-- Background Preview (if available) -->
        <div v-if="song.coverUrl || song.youtubeId"
          class="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-cover bg-center grayscale group-hover:grayscale-0 duration-500"
          :style="{ backgroundImage: `url(${song.coverUrl || `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`})` }">
        </div>

        <div class="relative z-10 flex justify-between items-start">
          <div class="flex-1 min-w-0 mr-4">
            <h3
              class="font-bold text-lg leading-tight truncate text-white group-hover:text-violet-300 transition-colors"
              :title="song.title">{{ song.title }}</h3>
            <p class="text-white/50 text-sm font-medium truncate">{{ song.artist }}</p>
          </div>

          <div class="flex flex-col items-end gap-1">
            <button @click.stop="song.id && removeSong(song.id)"
              class="text-white/20 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-white/10">
              <ClientOnly>
                <Icon name="material-symbols:close-rounded" class="w-5 h-5" />
              </ClientOnly>
            </button>
            <div v-if="song.rank"
              class="text-xs font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10">
              {{ song.rank }}
            </div>
          </div>
        </div>

        <div class="relative z-10 flex items-center justify-between mt-auto">
          <div class="flex items-center gap-2">
            <span
              class="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-black/50 backdrop-blur-md border border-white/10"
              :class="song.youtubeId ? 'text-red-400 border-red-500/20' : 'text-blue-400 border-blue-500/20'">
              <ClientOnly>
                <Icon
                  :name="song.youtubeId ? 'material-symbols:youtube-activity' : 'material-symbols:folder-open-rounded'"
                  class="w-3 h-3 inline mr-1" />
              </ClientOnly>
              {{ song.youtubeId ? 'YouTube' : 'Local' }}
            </span>
            <span v-if="isDuet(song)"
              class="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-violet-500/20 backdrop-blur-md border border-violet-500/30 text-violet-300">
              <ClientOnly>
                <Icon name="material-symbols:group-rounded" class="w-3 h-3 inline mr-1" />
              </ClientOnly>
              Dueto
            </span>
          </div>

          <div v-if="song.highScore"
            class="text-xs font-mono text-violet-300 bg-black/50 px-2 py-1 rounded border border-violet-500/20">
            {{ Math.round(song.highScore).toLocaleString() }} pts
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
