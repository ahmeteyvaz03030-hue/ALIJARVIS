import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { seeded } from '../../lib/motion'

export type ScannerState = 'idle' | 'scanning' | 'granted' | 'denied'

const COLORS: Record<ScannerState, string> = {
  idle: '#1a8ba3',
  scanning: '#35e6ff',
  granted: '#7cff9b',
  denied: '#ff5a6e',
}

/**
 * The biometric scanner: concentric rings turning at different rates, a radar
 * sweep, a tick ring, a dot orbit and a signature grid that fills as the match
 * progresses. Pure SVG + transforms, so it costs almost nothing.
 */
export function ScannerRing({
  state,
  progress,
  size = 260,
}: {
  state: ScannerState
  progress: number
  size?: number
}) {
  const { calm } = useSystem()
  const color = COLORS[state]
  const active = state === 'scanning'

  const ticks = useMemo(
    () => Array.from({ length: 60 }, (_, i) => i),
    [],
  )
  const signature = useMemo(() => {
    const rand = seeded(2317)
    return Array.from({ length: 34 }, () => 0.25 + rand() * 0.75)
  }, [])

  const R = 100
  const circ = 2 * Math.PI * R
  const spin = (dur: number, reverse = false) =>
    calm
      ? undefined
      : {
          rotate: reverse ? -360 : 360,
          transition: { duration: dur, repeat: Infinity, ease: 'linear' as const },
        }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* halo */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}2e, ${color}0d 45%, transparent 70%)`,
        }}
        animate={
          calm
            ? { opacity: 0.6 }
            : { opacity: active ? [0.55, 1, 0.55] : state === 'idle' ? [0.3, 0.5, 0.3] : 1, scale: state === 'granted' ? [1, 1.12, 1] : 1 }
        }
        transition={{ duration: active ? 1.1 : 2.6, repeat: state === 'granted' ? 0 : Infinity, ease: 'easeInOut' }}
      />

      <svg viewBox="-130 -130 260 260" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sweep-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="100%" stopColor={color} stopOpacity="0.75" />
          </linearGradient>
          <radialGradient id="sweep-fan">
            <stop offset="40%" stopColor={color} stopOpacity="0.02" />
            <stop offset="100%" stopColor={color} stopOpacity="0.3" />
          </radialGradient>
        </defs>

        {/* static base rings */}
        <circle r="118" fill="none" stroke={color} strokeOpacity="0.14" strokeWidth="1" />
        <circle r="62" fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="1" />
        <circle r="34" fill="none" stroke={color} strokeOpacity="0.22" strokeWidth="1" />

        {/* tick ring */}
        <motion.g animate={spin(48)} style={{ transformOrigin: '0px 0px' }}>
          {ticks.map((i) => {
            const long = i % 5 === 0
            return (
              <line
                key={i}
                x1="0"
                y1={-108}
                x2="0"
                y2={long ? -98 : -103}
                stroke={color}
                strokeOpacity={long ? 0.5 : 0.22}
                strokeWidth={long ? 1.4 : 1}
                transform={`rotate(${i * 6})`}
              />
            )
          })}
        </motion.g>

        {/* progress arc */}
        <circle
          r={R}
          fill="none"
          stroke={color}
          strokeOpacity="0.1"
          strokeWidth="3"
        />
        <motion.circle
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          transform="rotate(-90)"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - Math.min(1, progress / 100)) }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* dashed counter-rotating ring */}
        <motion.circle
          r="84"
          fill="none"
          stroke={color}
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="3 11"
          animate={spin(active ? 9 : 26, true)}
          style={{ transformOrigin: '0px 0px' }}
        />

        {/* broken arc segments */}
        <motion.g animate={spin(active ? 5.5 : 16)} style={{ transformOrigin: '0px 0px' }}>
          <path
            d="M 0 -74 A 74 74 0 0 1 64 -37"
            fill="none"
            stroke={color}
            strokeOpacity="0.85"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 0 74 A 74 74 0 0 1 -64 37"
            fill="none"
            stroke={color}
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </motion.g>

        {/* radar sweep fan */}
        {active && !calm && (
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '0px 0px' }}
          >
            <path d="M 0 0 L 0 -118 A 118 118 0 0 1 59 -102 Z" fill="url(#sweep-fan)" />
            <line x1="0" y1="0" x2="0" y2="-118" stroke="url(#sweep-grad)" strokeWidth="1.5" />
          </motion.g>
        )}

        {/* orbiting dots */}
        {!calm &&
          [0, 1, 2].map((i) => (
            <motion.g
              key={i}
              animate={{ rotate: i % 2 ? -360 : 360 }}
              transition={{
                duration: (active ? 3.4 : 11) + i * 2.4,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ transformOrigin: '0px 0px' }}
            >
              <circle
                cx="0"
                cy={-(62 + i * 22)}
                r={i === 1 ? 3 : 2}
                fill={color}
              />
            </motion.g>
          ))}

        {/* signature waveform inside the core */}
        <g>
          {signature.map((h, i) => {
            const filled = (i / signature.length) * 100 <= progress
            const x = -32 + i * 1.95
            return (
              <motion.line
                key={i}
                x1={x}
                x2={x}
                y1={-h * 15}
                y2={h * 15}
                stroke={color}
                strokeWidth="1.1"
                initial={false}
                animate={{
                  strokeOpacity: filled ? 0.95 : 0.16,
                  scaleY: filled ? 1 : 0.35,
                }}
                transition={{ duration: 0.24, delay: filled ? i * 0.008 : 0 }}
                style={{ transformOrigin: 'center' }}
              />
            )
          })}
        </g>

        {/* crosshair */}
        <line x1="-128" y1="0" x2="-116" y2="0" stroke={color} strokeOpacity="0.6" />
        <line x1="116" y1="0" x2="128" y2="0" stroke={color} strokeOpacity="0.6" />
        <line x1="0" y1="-128" x2="0" y2="-116" stroke={color} strokeOpacity="0.6" />
        <line x1="0" y1="116" x2="0" y2="128" stroke={color} strokeOpacity="0.6" />
      </svg>

      {/* centre readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-14">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="font-display text-xl font-black tabular-nums"
          style={{ color, textShadow: `0 0 14px ${color}99` }}
        >
          {state === 'granted' ? '100%' : `${Math.round(progress)}%`}
        </motion.div>
      </div>
    </div>
  )
}
