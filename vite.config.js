import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa permite publicar o build em qualquer subpasta (ex.: GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
})
