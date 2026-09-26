import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Cloudflare serves the SPA from the domain root. Deployment credentials and
// project binding are intentionally configured outside the repository later.
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
