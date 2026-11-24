import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Palette Studio - 色塗り練習ペイント',
        short_name: 'PaletteStudio',
        description: 'Androidタブレット・右利き向けCLIP STUDIO風カラーパレット搭載ペイントツール',
        theme_color: '#2b2b2b',
        background_color: '#232323',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
});
