import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useTypewriter } from '../../lib/hooks'
import { EASE, seeded } from '../../lib/motion'
import { SegmentBar } from '../hud/Readout'

interface BootLineSpec {
  text: string
  /** Right-hand status tag. */
  tag?: string
  tone?: 'cyan' | 'lime' | 'amber'
  /** Extra dwell after the line finishes typing, in ms. */
  dwell?: number
  /** Renders an inline mini loading bar under the line. */
  bar?: boolean
}

const LINES: BootLineSpec[] = [
  { text: 'INITIALIZING CORE...', tag: 'OK', dwell: 90, bar: true },
  { text: 'MEMORY CHECK...', tag: '16.0 GB', dwell: 70, bar: true },
  { text: 'SECURE ENCLAVE MOUNTED', tag: 'SEALED', tone: 'amber', dwell: 40 },
  { text: 'TRAVEL DATABASE CONNECTED', tag: 'ONLINE', tone: 'lime', dwell: 60 },
  { text: 'MARMARIS DATA ONLINE', tag: 'ONLINE', tone: 'lime', dwell: 60, bar: true },
  { text: 'ENTERTAINMENT DATABASE ONLINE', tag: 'ONLINE', tone: 'lime', dwell: 50 },
  { text: 'COMMUNICATION LINK ONLINE', tag: 'ENCRYPTED', tone: 'lime', dwell: 60 },
  { text: 'HUD RENDER PIPELINE CALIBRATED', tag: '60 FPS', dwell: 40 },
  { text: 'RONALJARVIS CORE ONLINE', tag: 'ACTIVE', tone: 'lime', dwell: 320 },
]

const TONE_HEX = { cyan: '#35e6ff', lime: '#7cff9b', amber: '#ffb54d' } as const

/* -------------------------------------------------------------------------- */
/* One terminal line                                                          */
/* -------------------------------------------------------------------------- */

function BootLine({
  spec,
  speed,
  active,
  onDone,
}: {
  spec: BootLineSpec
  speed: number
  active: boolean
  onDone: () => void
}) {
  const { cue } = useSystem()
  const [tagIn, setTagIn] = useState(!active)
  const color = TONE_HEX[spec.tone ?? 'cyan']

  const handleDone = useCallback(() => {
    setTagIn(true)
    cue('boot-line')
    window.setTimeout(onDone, spec.dwell ?? 60)
  }, [cue, onDone, spec.dwell])

  const { shown } = useTypewriter(spec.text, {
    cps: 190 * speed,
    enabled: active,
    onDone: active ? handleDone : undefined,
  })

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: EASE.snap }}
      className="font-mono text-[0.78rem] leading-relaxed sm:text-[0.86rem]"
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-cyan/45">&gt;</span>
        <span className="min-w-0 flex-1 break-words" style={{ color }}>
          {shown}
          {active && shown.length < spec.text.length && (
            <span className="jv-blink ml-px inline-block h-[0.9em] w-[0.5em] translate-y-[0.08em] bg-cyan align-middle" />
          )}
        </span>
        <AnimatePresence>
          {tagIn && spec.tag && (
            <motion.span
              initial={{ opacity: 0, scale: 1.4, letterSpacing: '0.6em' }}
              animate={{ opacity: 1, scale: 1, letterSpacing: '0.18em' }}
              transition={{ duration: 0.34, ease: EASE.out }}
              className="shrink-0 font-display text-[0.55rem] font-bold"
              style={{ color, textShadow: `0 0 12px ${color}80` }}
            >
              [ {spec.tag} ]
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {spec.bar && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.5 / speed, ease: 'linear' }}
          style={{ originX: 0 }}
          className="ml-4 mt-1 h-px bg-gradient-to-r from-cyan/70 via-cyan/25 to-transparent"
        />
      )}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Decorative side columns of streaming hex                                   */
/* -------------------------------------------------------------------------- */

function DataColumn({ side, seed }: { side: 'left' | 'right'; seed: number }) {
  const { calm } = useSystem()
  const rows = useMemo(() => {
    const rand = seeded(seed)
    return Array.from({ length: 26 }, () =>
      Array.from({ length: 4 }, () =>
        Math.floor(rand() * 0xffff)
          .toString(16)
          .padStart(4, '0')
          .toUpperCase(),
      ).join(' '),
    )
  }, [seed])

  if (calm) return null

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 hidden h-full w-40 overflow-hidden lg:block ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
      }}
    >
      <motion.div
        className="space-y-1 font-mono text-[0.55rem] text-cyan/20"
        animate={{ y: side === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        style={{ willChange: 'transform' }}
      >
        {[...rows, ...rows].map((row, i) => (
          <div key={i} className={side === 'right' ? 'text-right' : ''}>
            {row}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Boot sequence                                                              */
/* -------------------------------------------------------------------------- */

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const { calm, pushLog, cue } = useSystem()
  const [stage, setStage] = useState<'wake' | 'lines' | 'handoff'>('wake')
  const [index, setIndex] = useState(0)
  const finished = useRef(false)

  /** Repeat visits inside the same tab boot faster — the theatre keeps its
   *  impact once, then gets out of the way. */
  const speed = useMemo(() => {
    if (calm) return 4
    try {
      return sessionStorage.getItem('ronaljarvis.booted') ? 2.1 : 1
    } catch {
      return 1
    }
  }, [calm])

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    try {
      sessionStorage.setItem('ronaljarvis.booted', '1')
    } catch {
      /* ignore */
    }
    onComplete()
  }, [onComplete])

  /* Black screen → power-on. */
  useEffect(() => {
    const t = window.setTimeout(() => setStage('lines'), calm ? 120 : 620 / speed)
    return () => window.clearTimeout(t)
  }, [calm, speed])

  /* Seed the log with the boot record so the dashboard terminal has history. */
  useEffect(() => {
    pushLog('RONALJARVIS initialized', 'core')
    pushLog('Marmaris database synchronized', 'ok')
    pushLog('Flight data loaded', 'info')
    pushLog('Tony communication channel ready', 'ok')
    pushLog('All systems operational', 'core')
  }, [pushLog])

  /* Skip on any key or click. */
  useEffect(() => {
    const skip = () => {
      setIndex(LINES.length)
      setStage('handoff')
    }
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [])

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1
      if (next >= LINES.length) setStage('handoff')
      return next
    })
  }, [])

  /* Hand-off flash, then out. */
  useEffect(() => {
    if (stage !== 'handoff') return
    cue('unlock')
    const t = window.setTimeout(finish, calm ? 220 : 1150)
    return () => window.clearTimeout(t)
  }, [stage, calm, cue, finish])

  const progress = Math.min(100, Math.round((index / LINES.length) * 100))
  const visible = LINES.slice(0, Math.min(index + 1, LINES.length))

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-void"
      exit={{ opacity: 0, filter: 'brightness(2.4)', scale: 1.04 }}
      transition={{ duration: 0.55, ease: EASE.out }}
    >
      {/* power-on flash */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-30 bg-ice"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === 'wake' ? [0, 0.16, 0] : 0 }}
        transition={{ duration: 0.45 }}
      />

      {/* grid + glow ground */}
      <motion.div
        className="hairline-grid absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === 'wake' ? 0 : 1 }}
        transition={{ duration: 1.4, ease: EASE.out }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(53,230,255,0.13), rgba(53,230,255,0.03) 45%, transparent 70%)',
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: stage === 'wake' ? 0 : 1, scale: 1 }}
        transition={{ duration: 1.8, ease: EASE.out }}
      />

      <DataColumn side="left" seed={7} />
      <DataColumn side="right" seed={91} />

      {/* horizontal boot scan */}
      {!calm && stage !== 'wake' && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-20 h-24"
          style={{
            background:
              'linear-gradient(to bottom, transparent, rgba(53,230,255,0.10) 70%, rgba(53,230,255,0.55) 99%, transparent)',
            willChange: 'transform',
          }}
          initial={{ top: '-10%' }}
          animate={{ top: ['-12%', '108%'] }}
          transition={{ duration: 3.1 / speed, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <div className="relative z-10 flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-2xl">
          {/* header */}
          <AnimatePresence>
            {stage !== 'wake' && (
              <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE.out }}
                className="mb-6 border-b border-cyan/20 pb-3"
              >
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="hud-label mb-1">Personal Intelligence System</div>
                    <h1 className="font-display text-2xl font-black tracking-[0.16em] text-ice text-glow sm:text-3xl">
                      RONAL<span className="text-cyan">JARVIS</span>
                    </h1>
                  </div>
                  <div className="text-right font-mono text-[0.6rem] leading-relaxed text-cyan/50">
                    <div>BUILD 0.1.0-DEMO</div>
                    <div>NODE // ALI-PRIME</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* terminal */}
          <div className="min-h-[15rem] space-y-1.5 sm:min-h-[17rem]">
            {stage !== 'wake' &&
              visible.map((spec, i) => (
                <BootLine
                  key={spec.text}
                  spec={spec}
                  speed={speed}
                  active={i === index}
                  onDone={advance}
                />
              ))}
          </div>

          {/* progress */}
          <AnimatePresence>
            {stage !== 'wake' && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5, ease: EASE.out }}
                className="mt-7"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="hud-label">System Initialization</span>
                  <span className="font-mono text-sm tabular-nums text-cyan text-glow">
                    {String(stage === 'handoff' ? 100 : progress).padStart(3, ' ')}%
                  </span>
                </div>
                <SegmentBar value={stage === 'handoff' ? 100 : progress} segments={26} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[0.58rem] text-cyan/40">
                  <span>
                    {stage === 'handoff'
                      ? 'HANDING CONTROL TO IDENTITY GATE'
                      : `LOADING MODULE ${index + 1} / ${LINES.length}`}
                  </span>
                  <span className="hidden sm:inline">PRESS ANY KEY TO SKIP</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* hand-off banner */}
      <AnimatePresence>
        {stage === 'handoff' && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-cyan/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: EASE.out }}
              className="text-center"
            >
              <div className="font-display text-xl font-black tracking-[0.3em] text-ice text-glow-strong sm:text-3xl">
                CORE ONLINE
              </div>
              <div className="mt-2 font-mono text-[0.62rem] tracking-[0.35em] text-cyan/70">
                AWAITING IDENTITY
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
