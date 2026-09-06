import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { useSystem } from '../../state/SystemProvider'

/* -------------------------------------------------------------------------- */
/* Animated number                                                            */
/* -------------------------------------------------------------------------- */

interface AnimatedNumberProps {
  value: number
  decimals?: number
  suffix?: string
  className?: string
}

/** Springs to new values instead of snapping — telemetry that feels physical. */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const { calm } = useSystem()
  const raw = useMotionValue(value)
  const spring = useSpring(raw, calm ? { duration: 0 } : { stiffness: 120, damping: 20 })
  const text = useTransform(spring, (v) => `${v.toFixed(decimals)}${suffix}`)

  useEffect(() => {
    raw.set(value)
  }, [value, raw])

  return <motion.span className={className}>{text}</motion.span>
}

/* -------------------------------------------------------------------------- */
/* Segmented bar                                                              */
/* -------------------------------------------------------------------------- */

interface SegmentBarProps {
  /** 0–100 */
  value: number
  segments?: number
  tone?: 'cyan' | 'lime' | 'amber' | 'danger' | 'violet'
  className?: string
}

const TONE: Record<string, string> = {
  cyan: '53,230,255',
  lime: '124,255,155',
  amber: '255,181,77',
  danger: '255,90,110',
  violet: '169,123,255',
}

/** The `████████░░░` readout from the boot screen, as a live component. */
export function SegmentBar({
  value,
  segments = 18,
  tone = 'cyan',
  className = '',
}: SegmentBarProps) {
  const filled = Math.round((Math.min(100, Math.max(0, value)) / 100) * segments)
  const rgb = TONE[tone]
  return (
    <div className={`flex items-center gap-[2px] ${className}`} aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        <motion.span
          key={i}
          className="h-2.5 flex-1"
          // Colour is fixed and only opacity animates: animating
          // backgroundColor/boxShadow here repainted the whole bar on every
          // telemetry tick, opacity is handled by the compositor alone.
          style={{ backgroundColor: `rgb(${rgb})` }}
          initial={false}
          animate={{ opacity: i < filled ? 0.5 + (i / segments) * 0.5 : 0.09 }}
          transition={{ duration: 0.28, delay: i * 0.006 }}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Stat row                                                                   */
/* -------------------------------------------------------------------------- */

interface StatRowProps {
  label: string
  value: ReactNode
  bar?: number
  tone?: 'cyan' | 'lime' | 'amber' | 'danger' | 'violet'
}

export function StatRow({ label, value, bar, tone = 'cyan' }: StatRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label">{label}</span>
        <span
          className="font-mono text-[0.78rem] tabular-nums"
          style={{ color: `rgba(${TONE[tone]},0.95)` }}
        >
          {value}
        </span>
      </div>
      {bar !== undefined && <SegmentBar value={bar} segments={14} tone={tone} />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Status pill                                                                */
/* -------------------------------------------------------------------------- */

export function StatusPill({
  children,
  tone = 'lime',
  pulse = true,
}: {
  children: ReactNode
  tone?: 'cyan' | 'lime' | 'amber' | 'danger' | 'violet'
  pulse?: boolean
}) {
  const { calm, fx } = useSystem()
  const rgb = TONE[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.55rem] font-bold tracking-[0.2em]"
      style={{
        borderColor: `rgba(${rgb},0.4)`,
        color: `rgba(${rgb},0.95)`,
        background: `rgba(${rgb},0.08)`,
      }}
    >
      <motion.span
        className="h-1 w-1 rounded-full"
        style={{ background: `rgb(${rgb})` }}
        animate={pulse && !calm && fx.microPulses ? { opacity: [1, 0.25, 1], scale: [1, 0.8, 1] } : undefined}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {children}
    </span>
  )
}
