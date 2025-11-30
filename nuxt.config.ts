// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      title: 'SingMania!',
      titleTemplate: '%s | SingMania!',
      noscript: [
        { innerHTML: '<p>Por favor, ative o JavaScript para usar esta aplicação.</p>' }
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' }
      ]
    }
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'vue-sonner/nuxt'
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
    transpile: ['vue-virtual-scroller', '@supabase/supabase-js']
  },
})