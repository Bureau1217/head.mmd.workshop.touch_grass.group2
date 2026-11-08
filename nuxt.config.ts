// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  css: ['~/assets/_main.scss'],
  vite: {
    optimizeDeps: {
      include: ['ootk']
    }
  },
  runtimeConfig: {
    public: {
      proxyUrl: process.env.NUXT_PUBLIC_PROXY_URL || process.env.VITE_PROXY_URL || ''
    }
  }
})
