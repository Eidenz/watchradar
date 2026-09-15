import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [svelte()],
  clearScreen: false,
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: {
    port: 5181,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
