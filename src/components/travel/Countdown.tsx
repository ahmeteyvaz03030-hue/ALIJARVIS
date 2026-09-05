import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useCountdown } from '../../lib/hooks'
import { EASE } from '../../lib/motion'
import { TRIP } from '../../lib/config'

/** One odometer digit. Rolls up when its value changes. */
function Digit({ value, size }: { value: string; size: 'md' | 'lg' | 'xl' }) {
  const { calm } = useSystem()
  const cls = {
    md: 'text-2xl sm:text-3xl w-[0.62em]',
    lg: 'text-4xl sm:text-5xl w-[0.62em]',
    xl: 'text-5xl sm:text-7xl w-[0.62em]',
  }[size]

  if (calm) {
    return (
      <span className={`inline-block text-center font-display font-black tabular-nums ${cls}`}>
        {value}
      </span>
    )
  }

  return (
    <span className={`relative grid overflow-hidden text-center align-top ${cls}`}>
      {/* Plain AnimatePresence, not popLayout: popLayout absolutely-positions
          the outgoing digit and re-measures its siblings, which meant a forced
          layout pass every single second. The digits sit in a fixed-width box
          anyway, so nothing needs measuring. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          // No blur filter here: the seconds digit rolls once a second, and a
          // filter animation repaints instead of compositing.
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.38, ease: EASE.out }}
          className="block font-display font-black tabular-nums"
          style={{ gridArea: '1 / 1' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function Group({
  value,
  label,
  size,
}: {
  value: number
  label: string
  size: 'md' | 'lg' | 'xl'
}) {
  const text = String(value).padStart(2, '0')
  return (
    <div className="flex flex-col items-center">
      <span className="flex text-ice text-glow">
        {text.split('').map((d, i) => (
          <Digit key={i} value={d} size={size} />
        ))}
      </span>
      <span className="mt-1 font-display text-[0.5rem] font-bold tracking-[0.28em] text-cyan/55">
        {label}
      </span>
    </div>
  )
}

const Sep = ({ size }: { size: 'md' | 'lg' | 'xl' }) => {
  const { fx } = useSystem()
  return (
    <motion.span
      className={`self-start font-display font-black text-cyan/40 ${
        size === 'xl' ? 'text-4xl sm:text-6xl' : size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'
      }`}
      animate={fx.microPulses ? { opacity: [1, 0.2, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      :
    </motion.span>
  )
}

/**
 * Mission countdown. Digits roll, the colon breathes on the second, and each
 * time a whole day falls away the panel fires a short system animation and
 * writes a log line.
 */
export function Countdown({
  target = TRIP.departure,
  size = 'lg',
  prefix = 'T–',
}: {
  target?: Date
  size?: 'md' | 'lg' | 'xl'
  prefix?: string
}) {
  const { days, hours, minutes, seconds, done } = useCountdown(target)
  const { pushLog, cue, pulseCore, calm } = useSystem()
  const prevDays = useRef(days)
  const [dayChanged, setDayChanged] = useState(false)

  useEffect(() => {
    if (prevDays.current > days) {
      prevDays.current = days
      setDayChanged(true)
      pushLog(`Countdown rollover — ${days} day(s) to departure`, 'core')
      cue('notify')
      pulseCore(0.8, 500)
      const t = window.setTimeout(() => setDayChanged(false), 1600)
      return () => window.clearTimeout(t)
    }
    prevDays.current = days
  }, [days, pushLog, cue, pulseCore])

  return (
    <div className="relative">
      {/* day-rollover shockwave */}
      <AnimatePresence>
        {dayChanged && !calm && (
          <motion.div
            className="pointer-events-none absolute inset-0 border border-cyan"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-start justify-center gap-1.5 sm:gap-2.5">
        <span
          className={`self-start font-display font-black tracking-[0.1em] text-cyan/70 ${
            size === 'xl' ? 'text-2xl sm:text-4xl' : size === 'lg' ? 'text-xl sm:text-2xl' : 'text-base'
          }`}
        >
          {done ? 'T+' : prefix}
        </span>
        <Group value={days} label="TAGE" size={size} />
        <Sep size={size} />
        <Group value={hours} label="STD" size={size} />
        <Sep size={size} />
        <Group value={minutes} label="MIN" size={size} />
        <Sep size={size} />
        <Group value={seconds} label="SEK" size={size} />
      </div>
    </div>
  )
}
