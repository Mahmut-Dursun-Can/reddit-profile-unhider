import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        content: "src/content/content.js",
        background: "src/background/background.js",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
})