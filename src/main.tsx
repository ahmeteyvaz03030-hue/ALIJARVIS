import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { SystemProvider } from './state/SystemProvider'
import './index.css'

const host = document.getElementById('jarvis-root')
if (!host) throw new Error('RonalJarvis mount point missing')

createRoot(host).render(
  <StrictMode>
    <SystemProvider>
      <App />
    </SystemProvider>
  </StrictMode>,
)
