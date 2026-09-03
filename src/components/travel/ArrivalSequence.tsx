import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import { DESTINATION } from '../../lib/config'

/**
 * Celebration field: thin rising light shards plus a few slow embers.
 * Deliberately restrained — no confetti, no colour salad. One canvas, one loop,
 * self-terminating after ~6 s.
 */
function Celebration({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { perfTier } = useSystem()

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = (canvas.width = Math.floor(window.innerWidth * dpr))
    const h = (canvas.height = Math.floor(window.innerHeight * dpr))
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`

    const count = perfTier === 'low' ? 42 : 96
    const shards = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: h + Math.random() * h * 0.5,
      len: (12 + Math.random() * 46) * dpr,
      speed: (0.8 + Math.random() * 2.4) * dpr,
      drift: (Math.random() - 0.5) * 0.5 * dpr,
      alpha: 0.25 + Math.random() * 0.6,
      lime: Math.random() > 0.55,
      width: Math.random() > 0.85 ? 2 * dpr : 1 * dpr,
    }))

    let raf = 0
    const start = performance.now()

    const loop = (t: number) => {
      const elapsed = t - start
      const fade = elapsed > 4200 ? Math.max(0, 1 - (elapsed - 4200) / 1800) : 1
      ctx.clearRect(0, 0, w, h)
      for (const s of shards) {
        s.y -= s.speed
        s.x += s.drift
        if (s.y + s.len < 0) {
          s.y = h + Math.random() * 60
          s.x = Math.random() * w
        }
        const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.len)
        const rgb = s.lime ? '124,255,155' : '53,230,255'
        grad.addColorStop(0, `rgba(${rgb},${s.alpha * fade})`)
        grad.addColorStop(1, `rgba(${rgb},0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = s.width
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x, s.y + s.len)
        ctx.stroke()
      }
      if (fade > 0) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, perfTier])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[95]"
    />
  )
}

const LINES = [
  { text: 'DESTINATION REACHED', cls: 'text-[0.72rem] tracking-[0.34em] text-cyan/80' },
  { text: 'MARMARIS', cls: 'text-4xl sm:text-6xl tracking-[0.16em] text-ice text-glow-strong' },
  { text: 'TÜRKİYE', cls: 'text-lg sm:text-2xl tracking-[0.4em] text-lime text-glow-lime' },
]

/**
 * Arrival cinematic — plays once when the mission phase crosses into
 * `arrived`. Futuristic, warm, not kitsch.
 */
export function ArrivalSequence({ onDone }: { onDone: () => void }) {
  const { calm, cue, pushLog } = useSystem()
  const [step, setStep] = useState(0)

  useEffect(() => {
    cue('unlock')
    pushLog('Touchdown confirmed — Dalaman', 'ok')
    pushLog('HOLIDAY MODE initialized', 'core')
    const marks = calm ? [80, 200, 320, 460] : [500, 1500, 2500, 3600]
    const timers = marks.map((ms, i) =>
      window.setTimeout(() => {
        setStep(i + 1)
        if (i === 2) cue('confirm')
      }, ms),
    )
    timers.push(window.setTimeout(onDone, calm ? 900 : 7200))
    return () => timers.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {!calm && <Celebration active={step >= 2} />}
      <motion.div
        className="fixed inset-0 z-[94] flex items-center justify-center overflow-hidden bg-void/93 px-5 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.7, ease: EASE.out }}
      >
        {/* warm horizon glow — Marmaris, not a spaceship */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              'linear-gradient(to top, rgba(255,181,77,0.20), rgba(53,230,255,0.06) 45%, transparent)',
          }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: step >= 1 ? 1 : 0, y: 0 }}
          transition={{ duration: 1.8, ease: EASE.out }}
        />

        {/* landing rings */}
        {!calm &&
          step >= 1 &&
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime/30"
              initial={{ scale: 0.3, opacity: 0.7 }}
              animate={{ scale: 9, opacity: 0 }}
              transition={{ duration: 3.2, delay: i * 0.5, ease: 'easeOut' }}
            />
          ))}

        <div className="relative z-10 text-center">
          {LINES.map((line, i) => (
            <motion.div
              key={line.text}
              initial={{ opacity: 0, y: 26, filter: 'blur(14px)', letterSpacing: '0.8em' }}
              animate={
                step > i
                  ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                  : { opacity: 0, y: 26, filter: 'blur(14px)' }
              }
              transition={{ duration: 0.85, ease: EASE.out }}
              className={`font-display font-black ${line.cls} ${i === 0 ? 'mb-3' : 'mb-2'}`}
            >
              {line.text}
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={step >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, ease: EASE.out }}
            className="mt-7"
          >
            <div className="mx-auto mb-4 h-px w-40 bg-gradient-to-r from-transparent via-lime to-transparent" />
            <div className="font-display text-sm font-bold tracking-[0.22em] text-ice sm:text-lg">
              WELCOME TO MARMARIS, ALI.
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={step >= 4 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="mt-3 font-mono text-[0.64rem] tracking-[0.32em] text-lime/85"
            >
              HOLIDAY MODE INITIALIZED
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={step >= 4 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-2 font-mono text-[0.55rem] tracking-[0.24em] text-cyan/45"
            >
              {DESTINATION.lat.toFixed(4)}°N · {DESTINATION.lon.toFixed(4)}°E
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}
