import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// GitHub Pages serves a project site under /<repo>/, so the base path must
// match the repo name in production. Locally we serve from root.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/masterboard/' : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
}))
