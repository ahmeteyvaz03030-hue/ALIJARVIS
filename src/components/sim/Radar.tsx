import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useSystem } from '../../state/SystemProvider'

export interface RadarMarker {
  label: string
  /** Bearing in degrees, 0 = north. */
  angle: number
  /** 0 (centre) … 1 (outer ring). */
  dist: number
  tone?: 'cyan' | 'lime' | 'amber'
}

const TONE: Record<string, string> = {
  cyan: '53,230,255',
  lime: '124,255,155',
  amber: '255,181,77',
}

/**
 * MARMARIS AREA SCAN — a real radar: the beam rotates on one transform, and
 * every marker blips exactly when the beam crosses its bearing (the animation
 * delay is derived from the marker angle, so the two stay locked forever
 * without any per-frame JS).
 */
export function Radar({
  markers,
  period = 4.2,
  size = 240,
  label,
}: {
  markers: RadarMarker[]
  period?: number
  size?: number
  label?: string
}) {
  const { calm } = useSystem()
  const rings = [0.28, 0.55, 0.82, 1]

  const placed = useMemo(
    () =>
      markers.map((m) => {
        const rad = ((m.angle - 90) * Math.PI) / 180
        return {
          ...m,
          x: 50 + Math.cos(rad) * m.dist * 46,
          y: 50 + Math.sin(rad) * m.dist * 46,
          delay: (((m.angle % 360) + 360) % 360) / 360 * period,
        }
      }),
    [markers, period],
  )

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* grid */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {rings.map((r) => (
          <circle
            key={r}
            cx="50"
            cy="50"
            r={r * 46}
            fill="none"
            stroke="#35e6ff"
            strokeOpacity={r === 1 ? 0.3 : 0.14}
            strokeWidth="0.4"
          />
        ))}
        {[0, 45, 90, 135].map((deg) => (
          <line
            key={deg}
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="#35e6ff"
            strokeOpacity="0.1"
            strokeWidth="0.4"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="1.4" fill="#35e6ff" />
        {/* bearing labels */}
        {[
          ['N', 50, 6],
          ['E', 95, 51.5],
          ['S', 50, 97],
          ['W', 5, 51.5],
        ].map(([t, x, y]) => (
          <text
            key={t as string}
            x={x as number}
            y={y as number}
            fill="#35e6ff"
            fillOpacity="0.4"
            fontSize="3.4"
            textAnchor="middle"
            fontFamily="Share Tech Mono, monospace"
          >
            {t as string}
          </text>
        ))}
      </svg>

      {/* rotating beam */}
      {!calm && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(53,230,255,0.42), rgba(53,230,255,0.10) 22%, transparent 42%, transparent 100%)',
            clipPath: 'circle(46% at 50% 50%)',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: period, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* leading edge line */}
      {!calm && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[46%] w-px origin-bottom"
          style={{
            background: 'linear-gradient(to top, rgba(53,230,255,0.9), transparent)',
            transform: 'translateX(-50%) translateY(-100%)',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: period, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* contacts */}
      {placed.map((m) => {
        const rgb = TONE[m.tone ?? 'cyan']
        return (
          <div
            key={m.label}
            className="absolute"
            style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            {!calm && (
              <motion.span
                className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ borderColor: `rgb(${rgb})` }}
                animate={{ scale: [1, 4.2], opacity: [0.9, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: period - 1.5,
                  delay: m.delay,
                  ease: 'easeOut',
                }}
              />
            )}
            <motion.span
              className="relative block h-1.5 w-1.5 rounded-full"
              style={{ background: `rgb(${rgb})`, boxShadow: `0 0 8px rgba(${rgb},0.9)` }}
              animate={calm ? undefined : { opacity: [1, 0.45, 1] }}
              transition={{
                duration: period,
                repeat: Infinity,
                delay: m.delay,
                ease: 'easeOut',
              }}
            />
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[0.5rem] tracking-[0.12em]"
              style={{ color: `rgba(${rgb},0.75)` }}
            >
              {m.label}
            </span>
          </div>
        )
      })}

      {label && (
        <div className="absolute inset-x-0 -bottom-1 text-center font-mono text-[0.52rem] tracking-[0.24em] text-cyan/45">
          {label}
        </div>
      )}
    </div>
  )
}
