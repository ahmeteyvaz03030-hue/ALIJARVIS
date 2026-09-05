import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Relative asset URLs. The built site then works from *any* location — the
 * repo root, a GitHub Pages sub-path like /ALIJARVIS/, a custom domain, even
 * opened straight off disk — so a deployment can never break just because the
 * URL prefix changed. Override with VITE_BASE only if a host needs absolute
 * paths.
 */
const BASE = process.env.VITE_BASE ?? './'

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
