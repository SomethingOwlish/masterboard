import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Cloudflare serves the SPA from the domain root. Deployment credentials and
// project binding are intentionally configured outside the repository later.
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
