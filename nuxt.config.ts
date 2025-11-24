// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      title: 'SingMania!',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],
  nitro: {
    serverAssets: [
      {
        baseName: 'songs',
        dir: 'public/songs'
      }
    ]
  },
  build: {
    transpile: ['vue-virtual-scroller']
  }
})