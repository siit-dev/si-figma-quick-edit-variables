import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: 'src/ui',
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    emptyOutDir: false,
    outDir: '../../dist',
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'ui.js',
        assetFileNames: 'ui.[ext]',
      },
    },
  },
})

