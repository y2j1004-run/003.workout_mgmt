import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app under /<repo-name>/
// PREVIEW builds a single-page preview without the service worker (see scripts/build_preview.mjs)
const preview = !!process.env.PREVIEW
const base = preview ? './' : process.env.GITHUB_PAGES ? '/003.workout_mgmt/' : '/'

export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // the preview has no service worker, but the register module still resolves (as a no-op)
      disable: preview,
      // a new version waits until the user taps "지금 적용" (see UpdateBanner)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '건강관리 현황',
        short_name: '운동기록',
        description: '운동 기록과 인바디 추세를 관리하는 개인용 앱',
        lang: 'ko',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
