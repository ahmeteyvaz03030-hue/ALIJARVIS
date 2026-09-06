import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useHub } from '../../state/DataHub'
import { MODE_SPEC } from '../../lib/jarvisModes'
import { EASE } from '../../lib/motion'
import { JarvisChat } from './JarvisChat'
import { JarvisCore } from '../core/JarvisCore'

/**
 * RonalJarvis from anywhere.
 *
 * The point of the console is that no module has to be opened to get an
 * answer out of it — ⌘K / Strg+K from any view, ask, and it reaches into the
 * same hub the panels render from.
 */
export function JarvisConsole({
  open,
  unread,
  onClose,
  onNavigate,
}: {
  open: boolean
  unread: number
  onClose: () => void
  onNavigate: (view: string) => void
}) {
  const { calm, cue } = useSystem()
  const { mode } = useHub()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[6vh] sm:pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Konsole schließen"
            onClick={onClose}
            className={`absolute inset-0 ${calm ? 'bg-void/90' : 'bg-void/80 backdrop-blur-sm'}`}
          />

          <motion.div
            initial={{ opacity: 0, y: -22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.99 }}
            transition={{ duration: 0.32, ease: EASE.out }}
            className="panel-cut relative flex max-h-[82vh] w-full max-w-3xl flex-col border border-cyan/25 bg-void/95"
            role="dialog"
            aria-label="RonalJarvis Konsole"
          >
            <div className="flex items-center gap-3 border-b border-cyan/15 px-4 py-2.5">
              <div className="shrink-0">
                <JarvisCore size={40} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[0.6rem] font-black tracking-[0.24em] text-cyan">
                  RONALJARVIS KONSOLE
                </div>
                <div className="truncate font-mono text-[0.52rem] tracking-[0.14em] text-cyan/40">
                  {MODE_SPEC[mode].glyph} {MODE_SPEC[mode].label} · ESC ZUM SCHLIESSEN
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  cue('nav')
                  onClose()
                }}
                className="shrink-0 border border-cyan/25 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.14em] text-cyan/60 hover:border-cyan/60 hover:text-cyan"
              >
                ESC
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3">
              <JarvisChat
                unread={unread}
                compact
                autoFocus
                onNavigate={(view) => {
                  onNavigate(view)
                  onClose()
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
