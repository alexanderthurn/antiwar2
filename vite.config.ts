import { defineConfig } from 'vite';
import { looseSpritesDevPlugin } from './vite/looseSpritesDev';

export default defineConfig({
  base: './',
  plugins: [looseSpritesDevPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
