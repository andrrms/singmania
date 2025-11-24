<script setup lang="ts">
import { ref } from 'vue'
import SongCard from './SongCard.vue'

defineProps<{
	title: string
	songs: any[]
}>()

const emit = defineEmits<{
	(e: 'select', song: any): void
}>()

const scrollContainer = ref<HTMLElement | null>(null)

const scroll = (direction: 'left' | 'right') => {
	if (!scrollContainer.value) return
	const amount = direction === 'left' ? -400 : 400
	scrollContainer.value.scrollBy({ left: amount, behavior: 'smooth' })
}
</script>

<template>
	<div class="flex flex-col gap-4">
		<!-- Header -->
		<div class="flex items-center justify-between px-2">
			<h2 class="text-2xl font-bold text-white flex items-center gap-2">
				<slot name="icon"></slot>
				{{ title }}
			</h2>
			<div class="flex gap-2">
				<button @click="scroll('left')"
					class="p-2 rounded-full bg-white/5 hover:bg-white/20 text-white transition-colors">
					<ClientOnly>
						<Icon name="material-symbols:arrow-back-ios-new-rounded" class="w-5 h-5" />
					</ClientOnly>
				</button>
				<button @click="scroll('right')"
					class="p-2 rounded-full bg-white/5 hover:bg-white/20 text-white transition-colors">
					<ClientOnly>
						<Icon name="material-symbols:arrow-forward-ios-rounded" class="w-5 h-5" />
					</ClientOnly>
				</button>
			</div>
		</div>

		<!-- Carousel -->
		<div ref="scrollContainer" class="flex gap-6 overflow-x-auto pb-10 pt-6 px-6 snap-x snap-mandatory scrollbar-hide">
			<div v-for="song in songs" :key="song.id" class="snap-start shrink-0 w-[300px] md:w-[350px]">
				<SongCard :song="song" @click="emit('select', song)" />
			</div>

			<!-- Empty State -->
			<div v-if="songs.length === 0"
				class="w-full py-12 flex flex-col items-center justify-center text-white/30 border-2 border-dashed border-white/10 rounded-3xl">
				<p>Nenhuma música nesta categoria</p>
			</div>
		</div>
	</div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
	display: none;
}

.scrollbar-hide {
	-ms-overflow-style: none;
	scrollbar-width: none;
}
</style>
