import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

/** Short commit of this build, shown on the home page to tell whether a deploy has arrived. */
function buildHash(): string {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA
  if (fromCi) return fromCi.slice(0, 7)
  try { return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' }
}

// Cloudflare serves the SPA from the domain root. Deployment credentials and
// project binding are intentionally configured outside the repository later.
export default defineConfig({
  base: '/',
  plugins: [react()],
  define: {
    __BUILD_HASH__: JSON.stringify(buildHash()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Local development: `npm run worker:dev` serves /api (and signs you in as DEV_USER_EMAIL).
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
