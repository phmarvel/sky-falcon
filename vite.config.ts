/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works under https://<owner>.github.io/sky-falcon/ and on any other address.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // Phaser alone is about 1.2 MB: keep it in its own chunk so browsers cache it between releases.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
