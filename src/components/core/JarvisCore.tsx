import { motion, useTransform } from 'framer-motion'
import { useMemo } from 'react'
import { useStats, useSystem } from '../../state/SystemProvider'
import { seeded } from '../../lib/motion'

/* -------------------------------------------------------------------------- *
 * Performance note — this component used to cost ~33 FPS on its own.
 *
 * The old version was one big SVG whose <g> elements rotated. An SVG transform
 * is not compositable: every frame the browser had to re-rasterise the whole
 * drawing, and several children carried `filter: drop-shadow(...)`, so it also
 * recomputed a blur per element per frame.
 *
 * The rebuild keeps the look but changes the mechanics:
 *   · every continuously moving part is its own absolutely-positioned <div>
 *     layer holding a small static SVG. Only the *layer* rotates, so the GPU
 *     just re-uses an already-rasterised texture.
 *   · `drop-shadow` is gone. Glow is faked with a larger, low-opacity circle
 *     behind each dot — visually near-identical, essentially free.
 *   · the 48 individually-animated voiceprint lines became one static group
 *     whose wrapper scales, i.e. 1 animated value instead of 96.
 * -------------------------------------------------------------------------- */

interface JarvisCoreProps {
  size?: number
  caption?: string
  className?: string
}

/** A layer that spins forever. Promoted to its own compositor layer so the
 *  rotation never repaints what's inside it. */
function SpinLayer({
  duration,
  reverse = false,
  spin,
  children,
}: {
  duration: number
  reverse?: boolean
  spin: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ willChange: spin ? 'transform' : undefined }}
      animate={spin ? { rotate: reverse ? -360 : 360 } : undefined}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    >
      {children}
    </motion.div>
  )
}

/** Cheap glow: a soft fill circle instead of a blur filter. */
function GlowDot({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r * 3.2} fill={color} opacity="0.16" />
      <circle cx={cx} cy={cy} r={r * 1.9} fill={color} opacity="0.28" />
      <circle cx={cx} cy={cy} r={r} fill={color} />
    </>
  )
}

const VB = '-160 -160 320 320'

export function JarvisCore({ size = 320, caption, className = '' }: JarvisCoreProps) {
  const { calm, perfTier, coreIntensity, jarvisSpeaking, fx } = useSystem()

  const glowOpacity = useTransform(coreIntensity, [0, 1], [0.34, 1])
  const coreScale = useTransform(coreIntensity, [0, 1], [1, 1.09])
  const haloScale = useTransform(coreIntensity, [0, 1], [1, 1.16])

  const full = fx.coreDetail === 'full'
  const spin = !calm && fx.coreDetail !== 'static'
  const dense = perfTier === 'high' && !calm && full
  const speedUp = jarvisSpeaking ? 0.45 : 1

  const ticks = useMemo(() => Array.from({ length: dense ? 48 : 24 }, (_, i) => i), [dense])
  const spokes = useMemo(() => [12, 58, 104, 168, 212, 268, 314], [])
  const voice = useMemo(() => {
    const rand = seeded(4711)
    return Array.from({ length: dense ? 36 : 20 }, () => 0.2 + rand() * 0.8)
  }, [dense])

  return (
    <div className={`relative select-none ${className}`} style={{ width: size, height: size }}>
      {/* halo — opacity/scale only, both compositable */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(53,230,255,0.22), rgba(53,230,255,0.05) 42%, transparent 68%)',
          opacity: glowOpacity,
          scale: haloScale,
        }}
      />
      {spin && (
        <motion.div
          className="pointer-events-none absolute inset-[18%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(182,244,255,0.20), rgba(53,230,255,0.06) 55%, transparent 72%)',
            willChange: 'transform, opacity',
          }}
          animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.96, 1.05, 0.96] }}
          transition={{ duration: 3.6 * speedUp, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* ---- static base plate: everything that never moves, drawn once ---- */}
      <svg viewBox={VB} className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="core-centre">
            <stop offset="0%" stopColor="#eafcff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#35e6ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#35e6ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="core-spoke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#35e6ff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#35e6ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle r="150" fill="none" stroke="#35e6ff" strokeOpacity="0.13" />
        <circle r="128" fill="none" stroke="#35e6ff" strokeOpacity="0.1" />
        <circle r="88" fill="none" stroke="#35e6ff" strokeOpacity="0.2" />
        <circle r="60" fill="url(#core-centre)" opacity="0.55" />

        {/* radiating spokes */}
        {spokes.map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <line x1="152" y1="0" x2="176" y2="0" stroke="url(#core-spoke)" strokeWidth="1.2" />
            <circle cx="178" cy="0" r="1.6" fill="#35e6ff" fillOpacity="0.8" />
          </g>
        ))}

        {/* voiceprint collar — static geometry, the wrapper animates instead */}
        <g>
          {voice.map((h, i) => (
            <line
              key={i}
              x1="0"
              y1="-96"
              x2="0"
              y2={-96 - h * 12}
              stroke="#35e6ff"
              strokeWidth="1.6"
              strokeOpacity="0.45"
              transform={`rotate(${(i / voice.length) * 360})`}
            />
          ))}
        </g>
      </svg>

      {/* ---- moving layers: each one composited, none of them repaint ---- */}
      <SpinLayer duration={64} spin={spin}>
        <svg viewBox={VB} className="h-full w-full">
          {ticks.map((i) => {
            const long = i % 6 === 0
            return (
              <line
                key={i}
                x1="0"
                y1={-150}
                x2="0"
                y2={long ? -140 : -145}
                stroke="#35e6ff"
                strokeOpacity={long ? 0.42 : 0.16}
                strokeWidth={long ? 1.3 : 1}
                transform={`rotate(${(i * 360) / ticks.length})`}
              />
            )
          })}
        </svg>
      </SpinLayer>

      <SpinLayer duration={34 * speedUp} reverse spin={spin}>
        <svg viewBox={VB} className="h-full w-full">
          <circle r="128" fill="none" stroke="#35e6ff" strokeOpacity="0.34" strokeWidth="1" strokeDasharray="2 10" />
        </svg>
      </SpinLayer>

      <SpinLayer duration={19 * speedUp} spin={spin}>
        <svg viewBox={VB} className="h-full w-full">
          <path d="M 0 -110 A 110 110 0 0 1 95 -55" fill="none" stroke="#35e6ff" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 0 110 A 110 110 0 0 1 -95 55" fill="none" stroke="#35e6ff" strokeOpacity="0.4" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M -95 -55 A 110 110 0 0 1 -55 -95" fill="none" stroke="#b6f4ff" strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </SpinLayer>

      <SpinLayer duration={12 * speedUp} reverse spin={spin}>
        <svg viewBox={VB} className="h-full w-full">
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <GlowDot cx={0} cy={-88} r={2.6} color="#b6f4ff" />
            </g>
          ))}
        </svg>
      </SpinLayer>

      {/* radar sweep — one rotating layer, gradient rasterised once */}
      {spin && full && (
        <SpinLayer duration={7.5 * speedUp} spin={spin}>
          <svg viewBox={VB} className="h-full w-full">
            <defs>
              <radialGradient id="core-fan">
                <stop offset="30%" stopColor="#35e6ff" stopOpacity="0" />
                <stop offset="100%" stopColor="#35e6ff" stopOpacity="0.22" />
              </radialGradient>
            </defs>
            <path d="M 0 0 L 0 -150 A 150 150 0 0 1 92 -118 Z" fill="url(#core-fan)" />
            <line x1="0" y1="0" x2="0" y2="-150" stroke="#35e6ff" strokeOpacity="0.55" strokeWidth="1" />
          </svg>
        </SpinLayer>
      )}

      {/* dots running the rails */}
      {spin && full &&
        [
          { r: 150, dur: 9, rev: false, s: 3 },
          { r: 128, dur: 6.4, rev: true, s: 2.2 },
          { r: 110, dur: 4.6, rev: false, s: 2.6 },
          { r: 68, dur: 3.4, rev: true, s: 2 },
        ].map((rail, i) => (
          <SpinLayer key={i} duration={rail.dur * speedUp} reverse={rail.rev} spin={spin}>
            <svg viewBox={VB} className="h-full w-full">
              <GlowDot cx={0} cy={-rail.r} r={rail.s} color="#eafcff" />
            </svg>
          </SpinLayer>
        ))}

      {/* emanating pulses while speaking — transform/opacity only */}
      {jarvisSpeaking && spin && (
        <div className="pointer-events-none absolute inset-0">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full border border-ice/70"
              style={{ width: '38%', height: '38%', x: '-50%', y: '-50%', willChange: 'transform, opacity' }}
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.73, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}

      {/* centre — one scaling layer holding two counter-rotating polygons */}
      <motion.div className="absolute inset-0" style={{ scale: coreScale }}>
        <SpinLayer duration={26} reverse spin={spin}>
          <svg viewBox={VB} className="h-full w-full">
            <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" fill="none" stroke="#b6f4ff" strokeOpacity="0.75" strokeWidth="1.3" />
          </svg>
        </SpinLayer>
        <SpinLayer duration={15} spin={spin}>
          <svg viewBox={VB} className="h-full w-full">
            <polygon points="0,-18 16,-9 16,9 0,18 -16,9 -16,-9" fill="rgba(53,230,255,0.14)" stroke="#eafcff" strokeOpacity="0.85" strokeWidth="1" />
          </svg>
        </SpinLayer>
        {spin && (
          <motion.div
            className="absolute inset-0"
            style={{ willChange: 'transform, opacity' }}
            animate={{ scale: [0.97, 1.06, 0.97], opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 2.8 * speedUp, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg viewBox={VB} className="h-full w-full">
              <circle r="44" fill="none" stroke="#35e6ff" strokeWidth="1" />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* voiceprint excitation: one wrapper scales, not 48 lines */}
      {spin && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ willChange: 'transform, opacity' }}
          animate={
            jarvisSpeaking
              ? { scale: [1, 1.04, 1.01, 1.05, 1], opacity: [0.5, 1, 0.7, 0.95, 0.5] }
              : { scale: [1, 1.012, 1], opacity: [0.35, 0.6, 0.35] }
          }
          transition={{ duration: jarvisSpeaking ? 0.9 : 4.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox={VB} className="h-full w-full">
            {voice.map((h, i) => (
              <line
                key={i}
                x1="0"
                y1="-96"
                x2="0"
                y2={-96 - h * 12}
                stroke="#35e6ff"
                strokeWidth="1.6"
                strokeOpacity="0.5"
                transform={`rotate(${(i / voice.length) * 360})`}
              />
            ))}
          </svg>
        </motion.div>
      )}

      <CoreReadout jarvisSpeaking={jarvisSpeaking} calm={calm} />

      {caption && (
        <div className="absolute inset-x-0 -bottom-1 text-center font-mono text-[0.55rem] tracking-[0.3em] text-cyan/45">
          {caption}
        </div>
      )}
    </div>
  )
}

/** Split out so the 1.8 s telemetry tick re-renders these two lines of text
 *  instead of the entire core. */
function CoreReadout({ jarvisSpeaking, calm }: { jarvisSpeaking: boolean; calm: boolean }) {
  const stats = useStats()
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <motion.div
        className="font-display text-[0.55rem] font-bold tracking-[0.3em] text-ice/80"
        animate={calm ? undefined : { opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {jarvisSpeaking ? 'SPEAKING' : 'CORE'}
      </motion.div>
      <div className="mt-0.5 font-mono text-[0.55rem] tabular-nums text-cyan/60">
        {stats.coreTemp}°C · {stats.cpu}%
      </div>
    </div>
  )
}
