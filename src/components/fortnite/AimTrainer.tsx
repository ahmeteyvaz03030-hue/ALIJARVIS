import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import { HudButton } from '../hud/HudButton'

/* -------------------------------------------------------------------------- */
/* Drills                                                                     */
/* -------------------------------------------------------------------------- */

export type Drill = 'flick' | 'grid' | 'track'

interface DrillSpec {
  id: Drill
  name: string
  blurb: string
  /** Round length in seconds. */
  seconds: number
  targets: number
  radius: number
  /** Tracking is scored as time-on-target instead of hits. */
  tracking?: boolean
}

const DRILLS: Record<Drill, DrillSpec> = {
  flick: {
    id: 'flick',
    name: 'FLICK',
    blurb: 'Ein Ziel, überall. So schnell und genau wie möglich draufklicken.',
    seconds: 30,
    targets: 1,
    radius: 24,
  },
  grid: {
    id: 'grid',
    name: 'GRID SHOT',
    blurb: 'Sechs Ziele gleichzeitig. Reihenfolge egal, Tempo zählt.',
    seconds: 30,
    targets: 6,
    radius: 19,
  },
  track: {
    id: 'track',
    name: 'TRACKING',
    blurb: 'Ein Ziel bewegt sich. Fadenkreuz draufhalten, nicht klicken.',
    seconds: 25,
    targets: 1,
    radius: 34,
    tracking: true,
  },
}

export const DRILL_ORDER: Drill[] = ['flick', 'grid', 'track']

/* -------------------------------------------------------------------------- */
/* Records                                                                    */
/* -------------------------------------------------------------------------- */

export interface DrillRecord {
  score: number
  accuracy: number
  avgMs: number
  hits: number
  at: number
}

const PB_KEY = 'ronaljarvis.aim.v1'

function loadBests(): Partial<Record<Drill, DrillRecord>> {
  try {
    const raw = localStorage.getItem(PB_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<Record<Drill, DrillRecord>>)
      : {}
  } catch {
    return {}
  }
}

function saveBests(bests: Partial<Record<Drill, DrillRecord>>): void {
  try {
    localStorage.setItem(PB_KEY, JSON.stringify(bests))
  } catch {
    /* storage unavailable — records just won't survive a reload */
  }
}

/** Read the stored records without mounting the trainer (used by the briefing). */
export function aimRecords(): Partial<Record<Drill, DrillRecord>> {
  return loadBests()
}

/* -------------------------------------------------------------------------- */
/* Engine                                                                     */
/* -------------------------------------------------------------------------- */

interface Target {
  x: number
  y: number
  r: number
  born: number
  /** Tracking targets drift; click targets sit still. */
  vx: number
  vy: number
  seed: number
}

interface RoundState {
  hits: number
  misses: number
  reactionSum: number
  streak: number
  bestStreak: number
  onTargetMs: number
}

const EMPTY_ROUND: RoundState = {
  hits: 0,
  misses: 0,
  reactionSum: 0,
  streak: 0,
  bestStreak: 0,
  onTargetMs: 0,
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

export function AimTrainer() {
  const { cue, pushLog, calm } = useSystem()
  const [drill, setDrill] = useState<Drill>('flick')
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [remaining, setRemaining] = useState(DRILLS.flick.seconds)
  const [round, setRound] = useState<RoundState>(EMPTY_ROUND)
  const [bests, setBests] = useState(loadBests)
  const [lastRun, setLastRun] = useState<DrillRecord | null>(null)
  const [beatPb, setBeatPb] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const targetsRef = useRef<Target[]>([])
  const roundRef = useRef<RoundState>(EMPTY_ROUND)
  const pointerRef = useRef({ x: 0, y: 0, inside: false })
  const sizeRef = useRef({ w: 0, h: 0 })
  const endsAtRef = useRef(0)
  const rafRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // The render loop is rebuilt only when the drill changes, so it reaches the
  // current `finish` through a ref rather than closing over a stale one.
  const finishRef = useRef<() => void>(() => {})
  const bestsRef = useRef(bests)
  bestsRef.current = bests

  const spec = DRILLS[drill]

  /* ------------------------------------------------------------- sizing */
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      // Cap the backing store at 2× — a 4K pen display would otherwise push
      // several million pixels per frame for a 300 px panel.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  /* ------------------------------------------------------------- spawning */
  const spawn = useCallback((s: DrillSpec, now: number): Target => {
    const { w, h } = sizeRef.current
    const pad = s.radius + 10
    const angle = rand(0, Math.PI * 2)
    const speed = s.tracking ? rand(90, 165) : 0
    return {
      x: rand(pad, Math.max(pad + 1, w - pad)),
      y: rand(pad, Math.max(pad + 1, h - pad)),
      r: s.radius,
      born: now,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      seed: Math.random() * 1000,
    }
  }, [])

  /* ------------------------------------------------------------- the loop */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let last = performance.now()

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { w, h } = sizeRef.current
      const running = phaseRef.current === 'running'

      ctx.clearRect(0, 0, w, h)

      // grid backdrop
      ctx.strokeStyle = 'rgba(53,230,255,0.06)'
      ctx.lineWidth = 1
      for (let x = 0; x <= w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, h)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(w, y + 0.5)
        ctx.stroke()
      }

      if (running) {
        const s = DRILLS[drill]

        // move + bounce (tracking only)
        for (const t of targetsRef.current) {
          if (!t.vx && !t.vy) continue
          t.x += t.vx * dt
          t.y += t.vy * dt
          // a slow wobble makes tracking feel like a player, not a pendulum
          t.vx += Math.sin(now / 700 + t.seed) * 26 * dt
          t.vy += Math.cos(now / 610 + t.seed) * 26 * dt
          if (t.x < t.r) { t.x = t.r; t.vx = Math.abs(t.vx) }
          if (t.x > w - t.r) { t.x = w - t.r; t.vx = -Math.abs(t.vx) }
          if (t.y < t.r) { t.y = t.r; t.vy = Math.abs(t.vy) }
          if (t.y > h - t.r) { t.y = h - t.r; t.vy = -Math.abs(t.vy) }
        }

        // tracking score: milliseconds with the crosshair inside the circle
        if (s.tracking && pointerRef.current.inside) {
          const t = targetsRef.current[0]
          if (t) {
            const dx = pointerRef.current.x - t.x
            const dy = pointerRef.current.y - t.y
            if (dx * dx + dy * dy <= t.r * t.r) roundRef.current.onTargetMs += dt * 1000
          }
        }

        // targets
        for (const t of targetsRef.current) {
          const pulse = 1 + Math.sin(now / 220 + t.seed) * 0.03
          const r = t.r * pulse
          const gradient = ctx.createRadialGradient(t.x, t.y, r * 0.15, t.x, t.y, r)
          gradient.addColorStop(0, 'rgba(140,255,120,0.95)')
          gradient.addColorStop(0.55, 'rgba(53,230,255,0.55)')
          gradient.addColorStop(1, 'rgba(53,230,255,0.05)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
          ctx.fill()

          ctx.strokeStyle = 'rgba(216,246,255,0.9)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
          ctx.stroke()

          ctx.strokeStyle = 'rgba(4,8,13,0.8)'
          ctx.beginPath()
          ctx.moveTo(t.x - r * 0.45, t.y)
          ctx.lineTo(t.x + r * 0.45, t.y)
          ctx.moveTo(t.x, t.y - r * 0.45)
          ctx.lineTo(t.x, t.y + r * 0.45)
          ctx.stroke()
        }

        // crosshair
        if (pointerRef.current.inside) {
          const { x, y } = pointerRef.current
          ctx.strokeStyle = 'rgba(255,181,77,0.9)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x - 9, y)
          ctx.lineTo(x - 3, y)
          ctx.moveTo(x + 3, y)
          ctx.lineTo(x + 9, y)
          ctx.moveTo(x, y - 9)
          ctx.lineTo(x, y - 3)
          ctx.moveTo(x, y + 3)
          ctx.lineTo(x, y + 9)
          ctx.stroke()
        }

        // clock
        const left = Math.max(0, endsAtRef.current - now)
        const seconds = Math.ceil(left / 1000)
        setRemaining((prev) => (prev === seconds ? prev : seconds))
        if (left <= 0) finishRef.current()
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drill])

  /* ------------------------------------------------------------- lifecycle */
  const finish = useCallback(() => {
    if (phaseRef.current !== 'running') return
    phaseRef.current = 'done'
    setPhase('done')
    targetsRef.current = []

    const s = DRILLS[drill]
    const r = roundRef.current
    const shots = r.hits + r.misses
    const accuracy = s.tracking
      ? (r.onTargetMs / (s.seconds * 1000)) * 100
      : shots
        ? (r.hits / shots) * 100
        : 0
    const avgMs = r.hits ? Math.round(r.reactionSum / r.hits) : 0
    const score = s.tracking
      ? Math.round(accuracy * 10)
      : Math.max(0, r.hits * 10 - r.misses * 4 + r.bestStreak * 2)

    const record: DrillRecord = { score, accuracy, avgMs, hits: r.hits, at: Date.now() }
    setLastRun(record)
    setRound({ ...r })

    const previous = bestsRef.current[drill]
    // A blank round is not a record — without this, the first miss-only run
    // would be stored as a personal best of 0 and celebrated as one.
    const improved = score > 0 && (!previous || score > previous.score)
    setBeatPb(improved)
    if (improved) {
      const next = { ...bestsRef.current, [drill]: record }
      setBests(next)
      saveBests(next)
      pushLog(`Aim-Training: neuer Rekord in ${s.name} (${score})`, 'ok')
      cue('confirm')
    } else {
      pushLog(`Aim-Training beendet: ${s.name}, ${score} Punkte`, 'info')
      cue('nav')
    }
  }, [cue, drill, pushLog])

  finishRef.current = finish

  const start = useCallback(() => {
    const s = DRILLS[drill]
    const now = performance.now()
    roundRef.current = { ...EMPTY_ROUND }
    setRound({ ...EMPTY_ROUND })
    setLastRun(null)
    setBeatPb(false)
    targetsRef.current = Array.from({ length: s.targets }, () => spawn(s, now))
    endsAtRef.current = now + s.seconds * 1000
    setRemaining(s.seconds)
    phaseRef.current = 'running'
    setPhase('running')
    cue('process')
  }, [cue, drill, spawn])

  const stop = useCallback(() => {
    if (phaseRef.current === 'running') finish()
  }, [finish])

  // Switching drill mid-round would score the wrong game.
  useEffect(() => {
    phaseRef.current = 'idle'
    setPhase('idle')
    targetsRef.current = []
    setRound(EMPTY_ROUND)
    setLastRun(null)
    setRemaining(DRILLS[drill].seconds)
  }, [drill])

  /* ------------------------------------------------------------- input */
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    pointerRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      inside: true,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'running') return
    const s = DRILLS[drill]
    if (s.tracking) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const now = performance.now()

    const index = targetsRef.current.findIndex((t) => {
      const dx = x - t.x
      const dy = y - t.y
      return dx * dx + dy * dy <= t.r * t.r
    })

    const r = roundRef.current
    if (index >= 0) {
      const hit = targetsRef.current[index]
      r.hits += 1
      r.reactionSum += now - hit.born
      r.streak += 1
      r.bestStreak = Math.max(r.bestStreak, r.streak)
      targetsRef.current[index] = spawn(s, now)
      cue('panel')
    } else {
      r.misses += 1
      r.streak = 0
      cue('deny')
    }
    setRound({ ...r })
  }

  /* ------------------------------------------------------------- render */
  const shots = round.hits + round.misses
  const liveAccuracy = spec.tracking
    ? (round.onTargetMs / (spec.seconds * 1000)) * 100
    : shots
      ? (round.hits / shots) * 100
      : 0
  const pb = bests[drill]

  return (
    <div className="space-y-3">
      {/* drill picker */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DRILL_ORDER.map((id) => (
          <HudButton
            key={id}
            small
            variant={drill === id ? 'primary' : 'ghost'}
            onClick={() => setDrill(id)}
          >
            {DRILLS[id].name}
          </HudButton>
        ))}
        <span className="ml-auto font-mono text-[0.55rem] tracking-[0.14em] text-cyan/40">
          {spec.seconds}S RUNDE
        </span>
      </div>

      <p className="text-[0.74rem] leading-relaxed text-ice/60">{spec.blurb}</p>

      {/* arena */}
      <div
        ref={wrapRef}
        className="relative h-[19rem] w-full overflow-hidden border border-cyan/18 bg-void/70"
      >
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            pointerRef.current.inside = false
          }}
          onPointerDown={onPointerDown}
          className="absolute inset-0 touch-none"
          style={{ cursor: phase === 'running' ? 'none' : 'default' }}
        />

        {phase !== 'running' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE.out }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/70 px-4 text-center"
          >
            {phase === 'done' && lastRun ? (
              <>
                <div className="font-display text-[0.56rem] font-bold tracking-[0.24em] text-cyan/60">
                  {beatPb ? 'NEUER REKORD' : 'RUNDE BEENDET'}
                </div>
                <div
                  className="font-display text-4xl font-black tabular-nums"
                  style={{ color: beatPb ? '#8cff78' : '#d8f6ff' }}
                >
                  {lastRun.score}
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[0.6rem] tabular-nums text-cyan/60">
                  <span>{spec.tracking ? 'AUF ZIEL' : 'TREFFER'} {spec.tracking ? `${lastRun.accuracy.toFixed(1)}%` : lastRun.hits}</span>
                  {!spec.tracking && <span>GENAUIGKEIT {lastRun.accuracy.toFixed(1)}%</span>}
                  {!spec.tracking && <span>Ø {lastRun.avgMs} MS</span>}
                  {!spec.tracking && <span>SERIE {round.bestStreak}</span>}
                </div>
                <HudButton variant="primary" onClick={start}>
                  Nochmal
                </HudButton>
              </>
            ) : (
              <>
                <div className="font-display text-[0.56rem] font-bold tracking-[0.24em] text-cyan/55">
                  {spec.name} · {spec.seconds} SEKUNDEN
                </div>
                <HudButton variant="primary" onClick={start}>
                  Start
                </HudButton>
                {pb && (
                  <div className="font-mono text-[0.58rem] tabular-nums tracking-[0.14em] text-lime/60">
                    BESTWERT {pb.score}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* live HUD */}
        {phase === 'running' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 border-b border-cyan/12 bg-void/70 px-3 py-1.5 font-mono text-[0.6rem] tabular-nums tracking-[0.12em]">
            <span className="text-amber">{remaining}S</span>
            {spec.tracking ? (
              <span className="text-lime">AUF ZIEL {liveAccuracy.toFixed(0)}%</span>
            ) : (
              <>
                <span className="text-ice/80">{round.hits} TREFFER</span>
                <span className="text-cyan/60">{liveAccuracy.toFixed(0)}%</span>
                <span className="text-violet/80">SERIE {round.streak}</span>
              </>
            )}
            <button
              type="button"
              onClick={stop}
              className="pointer-events-auto border border-danger/40 px-1.5 text-[0.55rem] text-danger/80 hover:text-danger"
            >
              STOP
            </button>
          </div>
        )}
      </div>

      {/* personal bests */}
      <div className="grid grid-cols-3 gap-2 border-t border-cyan/12 pt-3">
        {DRILL_ORDER.map((id) => {
          const record = bests[id]
          return (
            <div key={id} className="border border-cyan/12 bg-cyan/[0.03] px-2 py-1.5">
              <div className="hud-label text-[0.44rem]">{DRILLS[id].name}</div>
              <div className="font-display text-[0.9rem] font-black tabular-nums text-lime">
                {record ? record.score : '—'}
              </div>
              <div className="font-mono text-[0.48rem] tabular-nums text-cyan/40">
                {record
                  ? DRILLS[id].tracking
                    ? `${record.accuracy.toFixed(0)}% auf Ziel`
                    : `${record.accuracy.toFixed(0)}% · ${record.avgMs} ms`
                  : 'noch kein Lauf'}
              </div>
            </div>
          )
        })}
      </div>

      {calm && (
        <p className="font-mono text-[0.55rem] leading-relaxed text-cyan/35">
          Hinweis: Reduzierte Bewegung ist aktiv. Das Training bleibt voll spielbar — nur die
          Panel-Animationen ringsum sind gedrosselt.
        </p>
      )}
    </div>
  )
}
