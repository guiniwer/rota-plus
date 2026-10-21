import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento, as chamadas para /api vão para o servidor Express (porta 3001)
const proxy = { '/api': 'http://localhost:3001' }

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy },
  preview: { proxy },
})
