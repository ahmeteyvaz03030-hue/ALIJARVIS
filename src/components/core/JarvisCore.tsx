import { motion, useTransform } from 'framer-motion'
import { useMemo } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { seeded } from '../../lib/motion'

interface JarvisCoreProps {
  size?: number
  /** Small caption under the core. */
  caption?: string
  className?: string
}

/**
 * The RonalJarvis core: five independently rotating ring systems, dots running
 * the rails, a radar sweep, radiating data spokes and a breathing centre.
 *
 * Excitation comes from `coreIntensity` (a MotionValue), so the whole thing
 * reacts to RonalJarvis speaking or processing without a single React re-render.
 */
export function JarvisCore({ size = 320, caption, className = '' }: JarvisCoreProps) {
  const { calm, perfTier, coreIntensity, jarvisSpeaking, stats } = useSystem()

  const glowOpacity = useTransform(coreIntensity, [0, 1], [0.34, 1])
  const coreScale = useTransform(coreIntensity, [0, 1], [1, 1.09])
  const haloScale = useTransform(coreIntensity, [0, 1], [1, 1.16])
  const spokeOpacity = useTransform(coreIntensity, [0, 1], [0.4, 0.95])

  const dense = perfTier === 'high' && !calm
  const ticks = useMemo(() => Array.from({ length: dense ? 72 : 36 }, (_, i) => i), [dense])
  const spokes = useMemo(() => [12, 58, 104, 168, 212, 268, 314], [])
  const voice = useMemo(() => {
    const rand = seeded(4711)
    return Array.from({ length: dense ? 48 : 28 }, () => 0.2 + rand() * 0.8)
  }, [dense])

  const spin = (dur: number, reverse = false) =>
    calm
      ? undefined
      : {
          rotate: reverse ? -360 : 360,
          transition: { duration: dur, repeat: Infinity, ease: 'linear' as const },
        }

  const speedUp = jarvisSpeaking ? 0.45 : 1

  return (
    <div className={`relative select-none ${className}`} style={{ width: size, height: size }}>
      {/* outer halo */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(53,230,255,0.22), rgba(53,230,255,0.05) 42%, transparent 68%)',
          opacity: glowOpacity,
          scale: haloScale,
        }}
      />
      {/* idle breathing bloom */}
      {!calm && (
        <motion.div
          className="pointer-events-none absolute inset-[18%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(182,244,255,0.20), rgba(53,230,255,0.06) 55%, transparent 72%)',
          }}
          animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.96, 1.05, 0.96] }}
          transition={{
            duration: 3.6 * speedUp,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <svg viewBox="-160 -160 320 320" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id="core-fan">
            <stop offset="30%" stopColor="#35e6ff" stopOpacity="0" />
            <stop offset="100%" stopColor="#35e6ff" stopOpacity="0.22" />
          </radialGradient>
          <linearGradient id="core-spoke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#35e6ff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#35e6ff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="core-centre">
            <stop offset="0%" stopColor="#eafcff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#35e6ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#35e6ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* radar sweep */}
        {!calm && (
          <motion.g animate={spin(7.5 * speedUp)} style={{ transformOrigin: '0px 0px' }}>
            <path d="M 0 0 L 0 -150 A 150 150 0 0 1 92 -118 Z" fill="url(#core-fan)" />
            <line x1="0" y1="0" x2="0" y2="-150" stroke="#35e6ff" strokeOpacity="0.55" strokeWidth="1" />
          </motion.g>
        )}

        {/* ring 1 — tick collar */}
        <motion.g animate={spin(64)} style={{ transformOrigin: '0px 0px' }}>
          <circle r="150" fill="none" stroke="#35e6ff" strokeOpacity="0.13" />
          {ticks.map((i) => {
            const long = i % (dense ? 6 : 3) === 0
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
        </motion.g>

        {/* ring 2 — dashed, reverse */}
        <motion.circle
          r="128"
          fill="none"
          stroke="#35e6ff"
          strokeOpacity="0.34"
          strokeWidth="1"
          strokeDasharray="2 10"
          animate={spin(34 * speedUp, true)}
          style={{ transformOrigin: '0px 0px' }}
        />

        {/* ring 3 — heavy broken arcs */}
        <motion.g animate={spin(19 * speedUp)} style={{ transformOrigin: '0px 0px' }}>
          <path d="M 0 -110 A 110 110 0 0 1 95 -55" fill="none" stroke="#35e6ff" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 0 110 A 110 110 0 0 1 -95 55" fill="none" stroke="#35e6ff" strokeOpacity="0.4" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M -95 -55 A 110 110 0 0 1 -55 -95" fill="none" stroke="#b6f4ff" strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" />
        </motion.g>

        {/* ring 4 — thin counter ring with node dots */}
        <motion.g animate={spin(12 * speedUp, true)} style={{ transformOrigin: '0px 0px' }}>
          <circle r="88" fill="none" stroke="#35e6ff" strokeOpacity="0.2" />
          {[0, 90, 180, 270].map((deg) => (
            <circle
              key={deg}
              cx={0}
              cy={-88}
              r="2.6"
              fill="#b6f4ff"
              transform={`rotate(${deg})`}
              style={{ filter: 'drop-shadow(0 0 6px #35e6ff)' }}
            />
          ))}
        </motion.g>

        {/* dots running the rails at different speeds */}
        {!calm &&
          [
            { r: 150, dur: 9, rev: false, size: 3 },
            { r: 128, dur: 6.4, rev: true, size: 2.2 },
            { r: 110, dur: 4.6, rev: false, size: 2.6 },
            { r: 68, dur: 3.4, rev: true, size: 2 },
          ].map((rail, i) => (
            <motion.g
              key={i}
              animate={spin(rail.dur * speedUp, rail.rev)}
              style={{ transformOrigin: '0px 0px' }}
            >
              <circle
                cx="0"
                cy={-rail.r}
                r={rail.size}
                fill="#eafcff"
                style={{ filter: 'drop-shadow(0 0 7px #35e6ff)' }}
              />
              <path
                d={`M 0 ${-rail.r} A ${rail.r} ${rail.r} 0 0 ${rail.rev ? 1 : 0} ${
                  rail.rev ? -rail.r * 0.34 : rail.r * 0.34
                } ${-rail.r * 0.94}`}
                fill="none"
                stroke="#35e6ff"
                strokeOpacity="0.45"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </motion.g>
          ))}

        {/* radiating data spokes */}
        <motion.g style={{ opacity: spokeOpacity }}>
          {spokes.map((deg, i) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <line x1="0" y1={-152} x2="0" y2={-172} stroke="url(#core-spoke)" strokeWidth="1.2" transform="rotate(180)" />
              <motion.line
                x1="152"
                y1="0"
                x2="176"
                y2="0"
                stroke="#35e6ff"
                strokeWidth="1.2"
                strokeOpacity="0.6"
                animate={calm ? undefined : { strokeOpacity: [0.15, 0.75, 0.15] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
              />
              <circle cx="178" cy="0" r="1.6" fill="#35e6ff" fillOpacity="0.8" />
            </g>
          ))}
        </motion.g>

        {/* emanating pulses while speaking */}
        {jarvisSpeaking &&
          !calm &&
          [0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              r="62"
              fill="none"
              stroke="#b6f4ff"
              strokeWidth="1.4"
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.73, ease: 'easeOut' }}
              style={{ transformOrigin: '0px 0px' }}
            />
          ))}

        {/* centre */}
        <motion.g style={{ scale: coreScale, transformOrigin: '0px 0px' }}>
          <circle r="60" fill="url(#core-centre)" opacity="0.55" />
          <motion.circle
            r="44"
            fill="none"
            stroke="#35e6ff"
            strokeWidth="1"
            strokeOpacity="0.55"
            initial={{ r: 42, strokeOpacity: 0.35 }}
            animate={calm ? { r: 44 } : { r: [42, 47, 42], strokeOpacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 2.8 * speedUp, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.g animate={spin(26, true)} style={{ transformOrigin: '0px 0px' }}>
            <polygon
              points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15"
              fill="none"
              stroke="#b6f4ff"
              strokeOpacity="0.75"
              strokeWidth="1.3"
            />
          </motion.g>
          <motion.g animate={spin(15)} style={{ transformOrigin: '0px 0px' }}>
            <polygon
              points="0,-18 16,-9 16,9 0,18 -16,9 -16,-9"
              fill="rgba(53,230,255,0.14)"
              stroke="#eafcff"
              strokeOpacity="0.85"
              strokeWidth="1"
            />
          </motion.g>
        </motion.g>

        {/* voiceprint collar */}
        <g>
          {voice.map((h, i) => {
            const angle = (i / voice.length) * 360
            return (
              <motion.line
                key={i}
                x1="0"
                y1="-96"
                x2="0"
                y2={-96 - h * 12}
                stroke="#35e6ff"
                strokeWidth="1.6"
                strokeOpacity="0.5"
                transform={`rotate(${angle})`}
                animate={
                  calm
                    ? undefined
                    : jarvisSpeaking
                      ? { scaleY: [0.3, 1, 0.45, 0.9, 0.3], strokeOpacity: [0.3, 0.9, 0.45, 0.8, 0.3] }
                      : { scaleY: [0.25, 0.5, 0.25], strokeOpacity: [0.2, 0.4, 0.2] }
                }
                transition={{
                  duration: jarvisSpeaking ? 0.9 : 4.2,
                  repeat: Infinity,
                  delay: (i % 7) * 0.11,
                  ease: 'easeInOut',
                }}
                style={{ transformOrigin: '0px -96px' }}
              />
            )
          })}
        </g>
      </svg>

      {/* centre readout */}
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

      {caption && (
        <div className="absolute inset-x-0 -bottom-1 text-center font-mono text-[0.55rem] tracking-[0.3em] text-cyan/45">
          {caption}
        </div>
      )}
    </div>
  )
}
