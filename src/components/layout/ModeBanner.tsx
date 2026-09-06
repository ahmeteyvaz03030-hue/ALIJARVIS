import { AnimatePresence, motion } from 'framer-motion'
import { useSystem } from '../../state/SystemProvider'
import { MODE_SPEC, type JarvisMode } from '../../lib/jarvisModes'
import { EASE } from '../../lib/motion'

/**
 * The strip that says *why* the interface looks the way it does right now.
 *
 * Normal mode is the absence of a reason, so it shows nothing — a permanent
 * banner saying "nothing special is happening" is just noise.
 */
export function ModeBanner({ mode, onOpen }: { mode: JarvisMode; onOpen: () => void }) {
  const { calm } = useSystem()
  const spec = MODE_SPEC[mode]
  const visible = mode !== 'normal'

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key={mode}
          type="button"
          onClick={onOpen}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: EASE.out }}
          className="relative z-30 flex w-full items-center justify-center gap-2 border-b px-3 py-1 text-center"
          style={{
            borderColor: `rgba(${spec.accent},0.3)`,
            background: `rgba(${spec.accent},0.08)`,
          }}
        >
          <span aria-hidden="true">{spec.glyph}</span>
          <span
            className="font-display text-[0.56rem] font-black tracking-[0.24em]"
            style={{ color: `rgb(${spec.accent})` }}
          >
            {spec.label}
          </span>
          <span className="hidden font-mono text-[0.55rem] tracking-[0.12em] text-ice/50 sm:inline">
            {spec.hint}
          </span>
          {!calm && (
            <motion.span
              className="h-1 w-1 rounded-full"
              style={{ background: `rgb(${spec.accent})` }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
