// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-04-16",
  devtools: { enabled: false },
  modules: [],
  future: {
    compatibilityVersion: 4,
  },
  pages: true,
  ssr: false,
  nitro: {
    preset: "cloudflare-module",
    prerender: {
      routes: ["/"],
      autoSubfolderIndex: false,
    },
  },
});
