<script setup lang="ts">
import { SpeedInsights } from "@vercel/speed-insights/nuxt"
import { Analytics } from '@vercel/analytics/nuxt'
import LoadingOverlay from '~/components/LoadingOverlay.vue'
import DeviceCheck from '~/components/DeviceCheck.vue'
import { onMounted } from 'vue'
import { useLoaderStore } from '~/stores/loader'

const loaderStore = useLoaderStore()

onMounted(() => {
  // Hide loader after mount
  setTimeout(() => {
    loaderStore.finishLoading()
  }, 1000)
})
</script>

<template>
  <div>
    <SpeedInsights />
    <Analytics />
    <DeviceCheck />
    <LoadingOverlay />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
/* Layout Transition (Blur/Fade) */
.layout-enter-active,
.layout-leave-active {
  transition: all 0.4s;
}

.layout-enter-from,
.layout-leave-to {
  opacity: 0;
  filter: blur(1rem);
}

/* Page Transitions */
.page-enter-active,
.page-leave-active {
  transition: all 0.2s ease-out;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(0.5rem);
}

/* Slide Up (Next Page) */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
  /* Reduced distance for snappier feel */
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
  filter: blur(2px);
}

/* Slide Down (Prev Page) */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(20px);
  filter: blur(2px);
}
</style>
