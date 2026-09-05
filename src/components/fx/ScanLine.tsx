import { motion } from 'framer-motion'
import { useSystem } from '../../state/SystemProvider'

type Tone = 'cyan' | 'lime' | 'amber'

const TONES: Record<Tone, string> = {
  cyan: '53,230,255',
  lime: '124,255,155',
  amber: '255,181,77',
}

/** Gradient band occupying a slice of a full-size layer, so one transform
 *  sweep covers any panel height without measuring anything. */
function band(rgb: string, vertical: boolean): string {
  const dir = vertical ? 'to right' : 'to bottom'
  return `linear-gradient(${dir},
    transparent 0%,
    transparent 40%,
    rgba(${rgb},0.06) 45%,
    rgba(${rgb},0.30) 49%,
    rgba(${rgb},0.95) 50%,
    rgba(${rgb},0.30) 51%,
    rgba(${rgb},0.06) 55%,
    transparent 60%,
    transparent 100%)`
}

interface ScanLineProps {
  /** Seconds for one pass. */
  duration?: number
  /** Seconds of dead time between passes — keeps panels from strobing in sync. */
  restDelay?: number
  orientation?: 'horizontal' | 'vertical'
  tone?: Tone
  opacity?: number
  className?: string
}

/** A single restrained scan pass across a panel, then a long rest. */
export function ScanLine({
  duration = 2.4,
  restDelay = 6,
  orientation = 'horizontal',
  tone = 'cyan',
  opacity = 0.7,
  className = '',
}: ScanLineProps) {
  const { calm, fx } = useSystem()
  if (calm || !fx.scanPasses) return null

  const vertical = orientation === 'vertical'
  const total = duration + restDelay
  const restFraction = restDelay / total

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: band(TONES[tone], vertical),
          willChange: 'transform, opacity',
          mixBlendMode: 'screen',
        }}
        initial={vertical ? { x: '-100%' } : { y: '-100%' }}
        animate={
          vertical
            ? { x: ['-100%', '-100%', '100%'], opacity: [0, opacity, 0] }
            : { y: ['-100%', '-100%', '100%'], opacity: [0, opacity, 0] }
        }
        transition={{
          duration: total,
          times: [0, restFraction, 1],
          ease: 'linear',
          repeat: Infinity,
        }}
      />
    </div>
  )
}

/** Continuous, faster scan for modules that are actively working. */
export function ActiveScan({ tone = 'cyan' }: { tone?: Tone }) {
  const { calm } = useSystem()
  if (calm) return null
  const rgb = TONES[tone]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={{
          background: band(rgb, false),
          willChange: 'transform',
          mixBlendMode: 'screen',
        }}
        animate={{ y: ['-100%', '100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
