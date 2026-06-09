import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    sourcemap: true,
    // Figma's sandbox parser does not accept optional chaining or nullish coalescing.
    target: 'es2017',
    lib: {
      entry: resolve(import.meta.dirname, 'src/main/index.ts'),
      formats: ['iife'],
      name: 'QuickEditVariables',
      fileName: () => 'code.js',
    },
  },
})
