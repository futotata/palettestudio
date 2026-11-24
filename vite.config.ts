import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const base = isGitHubPages ? '/palettestudio/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Palette Studio - 色塗り練習ペイント',
        short_name: 'PaletteStudio',
        description: 'Androidタブレット・右利き向けCLIP STUDIO風カラーパレット搭載ペイントツール',
        theme_color: '#2b2b2b',
        background_color: '#232323',
        display: 'standalone',
        orientation: 'any',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
});
