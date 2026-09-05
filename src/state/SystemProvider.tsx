import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { animate, useMotionValue, type MotionValue } from 'framer-motion'
import { playCue, setAudioEnabled, type Cue } from '../lib/audio'
import { resolvePhase, type FlightPhase } from '../lib/config'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MotionPreference = 'auto' | 'full' | 'calm'
export type MotionLevel = 'full' | 'calm'
export type PerfTier = 'high' | 'low'
export type Quality = 'auto' | 'high' | 'balanced' | 'lite'

/**
 * Which ambient effects are allowed to run continuously.
 *
 * Nothing here is about correctness — it's about how much of the screen is
 * being repainted every frame. Each always-on effect covers a large,
 * semi-transparent area, and a weaker GPU spends its whole frame budget
 * compositing them, which is what "the page feels laggy" actually means.
 */
export interface EffectBudget {
  /** Background particle field: full density, thinned out, or off. */
  particles: 'full' | 'reduced' | 'off'
  /** The hairline that sweeps the top edge of every HUD card. */
  cardShimmer: boolean
  /** Slow scan passes over panels. */
  scanPasses: boolean
  /** Rotating rings and rail dots in the RonalJarvis core.
   *  'static' keeps the artwork but stops it turning. */
  coreDetail: 'full' | 'reduced' | 'static'
  /** Rotating radar beam. */
  radarSweep: boolean
  /** Scrolling telemetry marquee in the top bar. */
  ticker: boolean
  /** Small decorative loops: blinking cursors, status dots, the spinning
   *  wordmark, badge pulses. Individually tiny, but a dozen of them keep the
   *  compositor busy every single frame. */
  microPulses: boolean
}

export interface Settings {
  motion: MotionPreference
  sound: boolean
  scanlines: boolean
  /** How many ambient effects may run at once. */
  quality: Quality
  /** Demo aid: force a mission phase to preview flight/arrival sequences. */
  phaseOverride: FlightPhase | null
  /** Operator's own TMDB key — see src/lib/tmdb.ts. Never shipped, never sent anywhere but themoviedb.org. */
  tmdbApiKey: string | null
  /** Operator's own fortniteapi.io key — see src/lib/fortniteEvents.ts. Sent only to fortniteapi.io. */
  fortniteApiKey: string | null
}

export type LogLevel = 'info' | 'ok' | 'warn' | 'core'

export interface LogEntry {
  id: number
  at: Date
  text: string
  level: LogLevel
}

export interface SystemStats {
  cpu: number
  memory: number
  network: number
  ping: number
  coreTemp: number
  uplink: number
  travelDb: 'SYNCED' | 'SYNCING'
  marmarisDb: 'ONLINE' | 'INDEXING'
  tonyLink: 'ACTIVE' | 'IDLE'
}

interface SystemContextValue {
  settings: Settings
  patchSettings: (patch: Partial<Settings>) => void
  motionLevel: MotionLevel
  /** Convenience: `true` when heavy motion must be suppressed. */
  calm: boolean
  /** Resolved ambient-effect budget for this device and setting. */
  fx: EffectBudget
  /** What `quality: 'auto'` resolved to. */
  resolvedQuality: Exclude<Quality, 'auto'>
  perfTier: PerfTier
  prefersReducedMotion: boolean
  pushLog: (text: string, level?: LogLevel) => void
  /** 0 = idle breathing, 1 = fully lit. Read by the core without re-rendering. */
  coreIntensity: MotionValue<number>
  pulseCore: (strength?: number, holdMs?: number) => void
  jarvisSpeaking: boolean
  setJarvisSpeaking: (speaking: boolean) => void
  phase: FlightPhase
  cue: (cue: Cue) => void
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

const SETTINGS_KEY = 'ronaljarvis.settings.v1'

/** Crude but effective device budget check, evaluated once. */
function detectPerfTier(): PerfTier {
  if (typeof window === 'undefined') return 'high'
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const narrow = window.matchMedia('(max-width: 820px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (cores <= 4 || mem <= 3) return 'low'
  if (narrow && coarse) return 'low'
  return 'high'
}

function defaultSettings(): Settings {
  return {
    motion: 'auto',
    sound: false,
    // The scanline overlay is a full-viewport mix-blend-mode layer that has
    // to re-blend every time anything under it moves — cheap to describe,
    // expensive to composite. It buys atmosphere, not function, so it starts
    // off on a device we've already flagged as tight on headroom.
    scanlines: detectPerfTier() === 'high',
    quality: 'auto',
    phaseOverride: null,
    tmdbApiKey: null,
    fortniteApiKey: null,
  }
}

function loadSettings(): Settings {
  const fallback = defaultSettings()
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return fallback
  }
}

const AMBIENT_LOGS: Array<[string, LogLevel]> = [
  ['Marmaris weather grid refreshed', 'info'],
  ['Flight RJ-2317 telemetry nominal', 'ok'],
  ['Entertainment index re-ranked', 'info'],
  ['Tony channel keep-alive ack', 'ok'],
  ['Core heuristics recalibrated', 'core'],
  ['Travel database delta applied', 'info'],
  ['Sea temperature sensor updated', 'info'],
  ['Route optimiser pass complete', 'ok'],
  ['Memory shards defragmented', 'info'],
  ['Uplink handshake renewed', 'ok'],
  ['Local cache pruned — 12 MB freed', 'info'],
  ['Ambient scan: no anomalies', 'core'],
]

const drift = (value: number, base: number, spread: number, lo: number, hi: number) => {
  const pull = (base - value) * 0.18
  const noise = (Math.random() - 0.5) * spread
  return Math.min(hi, Math.max(lo, value + pull + noise))
}

const SystemContext = createContext<SystemContextValue | null>(null)

/* `stats` ticks every 1.8 s and `log` grows every few seconds. Keeping them in
 * the main context meant every consumer — every HUD card, the nav rail, the
 * core — re-rendered on that tick, whether or not it showed a number. They now
 * live in their own contexts so only the handful of components that actually
 * display them pay for the update. */
const StatsContext = createContext<SystemStats | null>(null)
const LogContext = createContext<LogEntry[] | null>(null)

export function SystemProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [perfTier] = useState<PerfTier>(detectPerfTier)
  const [log, setLog] = useState<LogEntry[]>([])
  const [jarvisSpeaking, setJarvisSpeaking] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const logId = useRef(0)
  const coreIntensity = useMotionValue(0)

  const [stats, setStats] = useState<SystemStats>({
    cpu: 28,
    memory: 41,
    network: 97,
    ping: 24,
    coreTemp: 38,
    uplink: 94,
    travelDb: 'SYNCED',
    marmarisDb: 'ONLINE',
    tonyLink: 'ACTIVE',
  })

  /* --- reduced motion query ---------------------------------------------- */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const motionLevel: MotionLevel =
    settings.motion === 'calm'
      ? 'calm'
      : settings.motion === 'full'
        ? 'full'
        : prefersReducedMotion
          ? 'calm'
          : 'full'
  const calm = motionLevel === 'calm'

  /* 'auto' leans conservative: a device we already scored as low-tier gets the
   * lite budget, everything else gets balanced. Full detail is opt-in, because
   * an operator noticing "it looks amazing" is worth less than one noticing
   * "it feels smooth". */
  const resolvedQuality: Exclude<Quality, 'auto'> =
    settings.quality === 'auto'
      ? perfTier === 'low'
        ? 'lite'
        : 'balanced'
      : settings.quality

  const fx = useMemo<EffectBudget>(() => {
    if (calm) {
      return {
        particles: 'off',
        cardShimmer: false,
        scanPasses: false,
        coreDetail: 'static',
        radarSweep: false,
        ticker: false,
        microPulses: false,
      }
    }
    switch (resolvedQuality) {
      case 'high':
        return {
          particles: 'full',
          cardShimmer: true,
          scanPasses: true,
          coreDetail: 'full',
          radarSweep: true,
          ticker: true,
          microPulses: true,
        }
      case 'balanced':
        return {
          particles: 'reduced',
          // The per-card shimmer is the single biggest source of always-on
          // animation: one per HUD card, so a dashboard runs eight at once.
          cardShimmer: false,
          scanPasses: true,
          coreDetail: 'full',
          radarSweep: true,
          ticker: true,
          microPulses: true,
        }
      case 'lite':
      default:
        return {
          particles: 'off',
          cardShimmer: false,
          scanPasses: false,
          coreDetail: 'static',
          radarSweep: false,
          ticker: false,
          microPulses: false,
        }
    }
  }, [calm, resolvedQuality])

  /* --- persist + reflect settings onto the document ---------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
    setAudioEnabled(settings.sound)
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.motion = motionLevel === 'calm' ? 'calm' : 'full'
    root.dataset.perf = perfTier
    root.dataset.scanlines = settings.scanlines && !calm ? 'on' : 'off'
    root.dataset.quality = resolvedQuality
  }, [motionLevel, perfTier, settings.scanlines, calm, resolvedQuality])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const cue = useCallback((c: Cue) => playCue(c), [])

  /* --- system log --------------------------------------------------------- */
  const pushLog = useCallback((text: string, level: LogLevel = 'info') => {
    setLog((prev) => {
      const entry: LogEntry = { id: ++logId.current, at: new Date(), text, level }
      const next = [...prev, entry]
      return next.length > 40 ? next.slice(next.length - 40) : next
    })
  }, [])

  /* Ambient chatter so the terminal keeps living. */
  useEffect(() => {
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          const [text, level] =
            AMBIENT_LOGS[Math.floor(Math.random() * AMBIENT_LOGS.length)]
          pushLog(text, level)
          schedule()
        },
        7000 + Math.random() * 9000,
      )
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [pushLog])

  /* --- simulated telemetry ------------------------------------------------ */
  useEffect(() => {
    const tick = window.setInterval(() => {
      setStats((s) => ({
        cpu: Math.round(drift(s.cpu, 31, 9, 12, 78)),
        memory: Math.round(drift(s.memory, 43, 5, 26, 72)),
        network: Math.round(drift(s.network, 97, 3, 84, 100)),
        ping: Math.round(drift(s.ping, 24, 9, 8, 92)),
        coreTemp: Math.round(drift(s.coreTemp, 38, 3, 32, 55)),
        uplink: Math.round(drift(s.uplink, 95, 4, 78, 100)),
        travelDb: Math.random() > 0.93 ? 'SYNCING' : 'SYNCED',
        marmarisDb: Math.random() > 0.96 ? 'INDEXING' : 'ONLINE',
        tonyLink: Math.random() > 0.97 ? 'IDLE' : 'ACTIVE',
      }))
    }, 1800)
    return () => window.clearInterval(tick)
  }, [])

  /* --- mission clock ------------------------------------------------------ */
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  const phase = settings.phaseOverride ?? resolvePhase(now)

  /* --- core excitation ---------------------------------------------------- */
  const pulseCore = useCallback(
    (strength = 1, holdMs = 260) => {
      if (calm) {
        coreIntensity.set(Math.min(0.45, strength * 0.45))
        return
      }
      animate(coreIntensity, strength, { duration: 0.16, ease: [0.05, 0.7, 0.1, 1] })
      window.setTimeout(() => {
        animate(coreIntensity, 0, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })
      }, holdMs)
    },
    [calm, coreIntensity],
  )

  /* Speaking keeps the core hot for as long as it lasts. */
  useEffect(() => {
    if (jarvisSpeaking) {
      animate(coreIntensity, 0.85, { duration: 0.35, ease: [0.16, 1, 0.3, 1] })
    } else {
      animate(coreIntensity, 0, { duration: 1.1, ease: [0.16, 1, 0.3, 1] })
    }
  }, [jarvisSpeaking, coreIntensity])

  const value = useMemo<SystemContextValue>(
    () => ({
      settings,
      patchSettings,
      motionLevel,
      calm,
      fx,
      resolvedQuality,
      perfTier,
      prefersReducedMotion,
      pushLog,
      coreIntensity,
      pulseCore,
      jarvisSpeaking,
      setJarvisSpeaking,
      phase,
      cue,
    }),
    [
      settings,
      patchSettings,
      motionLevel,
      calm,
      fx,
      resolvedQuality,
      perfTier,
      prefersReducedMotion,
      pushLog,
      coreIntensity,
      pulseCore,
      jarvisSpeaking,
      phase,
      cue,
    ],
  )

  return (
    <SystemContext.Provider value={value}>
      <StatsContext.Provider value={stats}>
        <LogContext.Provider value={log}>{children}</LogContext.Provider>
      </StatsContext.Provider>
    </SystemContext.Provider>
  )
}

/** Live telemetry. Subscribing re-renders on every 1.8 s tick — only use it
 *  in the smallest component that actually prints a number. */
export function useStats(): SystemStats {
  const ctx = useContext(StatsContext)
  if (!ctx) throw new Error('useStats must be used inside <SystemProvider>')
  return ctx
}

/** The rolling system journal. */
export function useLog(): LogEntry[] {
  const ctx = useContext(LogContext)
  if (!ctx) throw new Error('useLog must be used inside <SystemProvider>')
  return ctx
}

export function useSystem(): SystemContextValue {
  const ctx = useContext(SystemContext)
  if (!ctx) throw new Error('useSystem must be used inside <SystemProvider>')
  return ctx
}
