import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages serves the site from a sub-path (…github.io/ALIJARVIS/), so the
 * production build needs a matching `base`. Override it with VITE_BASE when
 * deploying somewhere else — set VITE_BASE=/ for a custom domain or a root
 * host. The dev server always runs at `/`.
 */
const BASE = process.env.VITE_BASE ?? '/ALIJARVIS/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Keep three.js off the critical path so the boot sequence paints instantly.
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-'))
            return 'motion'
          return undefined
        },
      },
    },
  },
}))
