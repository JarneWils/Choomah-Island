import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'home.html'),
      },
    },
  },
});
