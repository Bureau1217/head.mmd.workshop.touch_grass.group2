// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/_main.scss'],
  vite: {
    optimizeDeps: {
      include: ['ootk']
    }
  },
  runtimeConfig: {
    public: {
      apiKey: process.env.API_KEY || ''
    }
  }
})
