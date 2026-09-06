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
import { useSystem } from './SystemProvider'
import { loadFootball, type FootballSnapshot } from '../lib/football'
import { fetchStatus, type FortniteStatus } from '../lib/fortnite'
import { fetchLiveCups, lookupPlayer, type LiveCup, type PlayerStats } from '../lib/fortniteEvents'
import { getCupSchedule } from '../lib/fortniteCups'
import { fetchNowPlaying, fetchUpcomingMovies, type TmdbListItem } from '../lib/tmdb'
import { resolveMode, type JarvisMode } from '../lib/jarvisModes'

/* -------------------------------------------------------------------------- */
/* Slices                                                                     */
/* -------------------------------------------------------------------------- */

export type SliceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface Slice<T> {
  status: SliceStatus
  data: T | null
  error: string | null
  /** When `data` was last filled in. */
  at: number
}

const EMPTY: Slice<never> = { status: 'idle', data: null, error: null, at: 0 }

export interface MovieReleases {
  nowPlaying: TmdbListItem[]
  upcoming: TmdbListItem[]
}

export interface FortniteLive {
  status: FortniteStatus | null
  cups: LiveCup[] | null
}

export interface HubShape {
  football: Slice<FootballSnapshot>
  fortnite: Slice<FortniteLive>
  player: Slice<PlayerStats>
  releases: Slice<MovieReleases>
}

export type HubKey = keyof HubShape

/** How long a slice stays fresh. Match schedules move slowly; cups do not. */
const TTL: Record<HubKey, number> = {
  football: 15 * 60_000,
  fortnite: 5 * 60_000,
  player: 5 * 60_000,
  releases: 30 * 60_000,
}

interface HubValue {
  hub: HubShape
  /** Fetch the slice if it is missing or stale, then resolve with it. */
  ensure: <K extends HubKey>(key: K) => Promise<HubShape[K]>
  /** Force a refetch regardless of age. */
  refresh: <K extends HubKey>(key: K) => Promise<HubShape[K]>
  /** The interface mode this situation resolves to. */
  mode: JarvisMode
  /** Hours until Beşiktaş kick off; `null` when no fixture is loaded. */
  hoursToKickoff: number | null
}

const HubContext = createContext<HubValue | null>(null)

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

const initialHub: HubShape = {
  football: EMPTY,
  fortnite: EMPTY,
  player: EMPTY,
  releases: EMPTY,
}

/**
 * One cache in front of every external service the app talks to.
 *
 * Without it each module fetched on its own and RonalJarvis had nothing to
 * read — so the assistant could only answer from static data while the panels
 * showed something newer. Now both sides read the same slices, and asking
 * RonalJarvis a question warms exactly the module it needs.
 */
export function DataHubProvider({ children }: { children: ReactNode }) {
  const { settings, phase, pushLog } = useSystem()
  const [hub, setHub] = useState<HubShape>(initialHub)

  // Loaders read keys through a ref so `ensure` stays stable across renders
  // and effects that call it don't re-fire on every settings tick.
  const keys = useRef({
    fortniteApiKey: settings.fortniteApiKey,
    tmdbApiKey: settings.tmdbApiKey,
    sportsDbKey: settings.sportsDbKey,
    epicName: settings.epicName,
  })
  keys.current = {
    fortniteApiKey: settings.fortniteApiKey,
    tmdbApiKey: settings.tmdbApiKey,
    sportsDbKey: settings.sportsDbKey,
    epicName: settings.epicName,
  }

  const inflight = useRef(new Map<HubKey, Promise<unknown>>())

  const patch = useCallback(<K extends HubKey>(key: K, slice: HubShape[K]) => {
    setHub((prev) => ({ ...prev, [key]: slice }))
  }, [])

  const load = useCallback(
    async (key: HubKey): Promise<Slice<unknown>> => {
      const now = Date.now()
      switch (key) {
        case 'football': {
          const result = await loadFootball(keys.current.sportsDbKey ?? undefined)
          return result.ok
            ? { status: 'ready', data: result.data, error: null, at: now }
            : { status: 'error', data: null, error: result.message, at: now }
        }
        case 'fortnite': {
          const [statusResult, cupResult] = await Promise.all([
            fetchStatus(),
            keys.current.fortniteApiKey
              ? fetchLiveCups(keys.current.fortniteApiKey, 'EU')
              : Promise.resolve(null),
          ])
          const data: FortniteLive = {
            status: statusResult.ok ? statusResult.data : null,
            cups: cupResult && cupResult.ok ? cupResult.data : null,
          }
          const failed = !statusResult.ok && !(cupResult && cupResult.ok)
          return failed
            ? { status: 'error', data, error: 'Fortnite-Dienste nicht erreichbar.', at: now }
            : { status: 'ready', data, error: null, at: now }
        }
        case 'player': {
          const apiKey = keys.current.fortniteApiKey
          const name = keys.current.epicName
          if (!apiKey || !name) {
            return {
              status: 'error',
              data: null,
              error: !apiKey
                ? 'Für Spielerdaten fehlt der fortniteapi.io-Schlüssel.'
                : 'Kein Epic-Name hinterlegt — in den Einstellungen eintragen.',
              at: now,
            }
          }
          const result = await lookupPlayer(apiKey, name)
          return result.ok
            ? { status: 'ready', data: result.data, error: null, at: now }
            : { status: 'error', data: null, error: result.message, at: now }
        }
        case 'releases': {
          const apiKey = keys.current.tmdbApiKey
          if (!apiKey) {
            return {
              status: 'error',
              data: null,
              error: 'Für echte Kinodaten fehlt der TMDB-Schlüssel.',
              at: now,
            }
          }
          const [nowPlaying, upcoming] = await Promise.all([
            fetchNowPlaying(apiKey, 1),
            fetchUpcomingMovies(apiKey, 1),
          ])
          if (!nowPlaying.ok && !upcoming.ok) {
            return { status: 'error', data: null, error: nowPlaying.message, at: now }
          }
          return {
            status: 'ready',
            data: {
              nowPlaying: nowPlaying.ok ? nowPlaying.data.results.slice(0, 10) : [],
              upcoming: upcoming.ok ? upcoming.data.results.slice(0, 10) : [],
            },
            error: null,
            at: now,
          }
        }
      }
    },
    [],
  )

  const run = useCallback(
    <K extends HubKey>(key: K, force: boolean): Promise<HubShape[K]> => {
      const existing = inflight.current.get(key)
      if (existing) return existing as Promise<HubShape[K]>

      const promise = (async () => {
        patch(key, { status: 'loading', data: null, error: null, at: 0 } as HubShape[K])
        let slice: Slice<unknown>
        try {
          slice = await load(key)
        } catch (err) {
          slice = {
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : 'Unbekannter Fehler.',
            at: Date.now(),
          }
        }
        patch(key, slice as HubShape[K])
        if (slice.status === 'error' && slice.error) pushLog(`${key}: ${slice.error}`, 'warn')
        inflight.current.delete(key)
        return slice as HubShape[K]
      })()

      inflight.current.set(key, promise)
      void force
      return promise
    },
    [load, patch, pushLog],
  )

  // `hub` is read inside ensure, so keep a ref to avoid rebuilding the callback.
  const hubRef = useRef(hub)
  hubRef.current = hub

  const ensure = useCallback(
    <K extends HubKey>(key: K): Promise<HubShape[K]> => {
      const slice = hubRef.current[key]
      const fresh = slice.status === 'ready' && Date.now() - slice.at < TTL[key]
      if (fresh) return Promise.resolve(slice)
      if (slice.status === 'loading') {
        const pending = inflight.current.get(key)
        if (pending) return pending as Promise<HubShape[K]>
      }
      return run(key, false)
    },
    [run],
  )

  const refresh = useCallback(
    <K extends HubKey>(key: K): Promise<HubShape[K]> => run(key, true),
    [run],
  )

  // A stale slice is dropped when the key behind it changes, so the next read
  // refetches instead of showing data fetched with a key that no longer exists.
  useEffect(() => {
    setHub((prev) => ({ ...prev, fortnite: EMPTY, player: EMPTY }))
  }, [settings.fortniteApiKey, settings.epicName])

  useEffect(() => {
    setHub((prev) => ({ ...prev, releases: EMPTY }))
  }, [settings.tmdbApiKey])

  useEffect(() => {
    setHub((prev) => ({ ...prev, football: EMPTY }))
  }, [settings.sportsDbKey])

  /* ------------------------------------------------------------------ mode */

  const nextKickoff = hub.football.data?.next.find((f) => f.kickoff)?.kickoff ?? null
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const hoursToKickoff = nextKickoff ? (nextKickoff.getTime() - tick) / 3_600_000 : null

  const mode = useMemo(
    () =>
      resolveMode({
        phase,
        hoursToKickoff,
        hour: new Date(tick).getHours(),
        override: settings.modeOverride,
      }),
    [phase, hoursToKickoff, tick, settings.modeOverride],
  )

  const value = useMemo<HubValue>(
    () => ({ hub, ensure, refresh, mode, hoursToKickoff }),
    [hub, ensure, refresh, mode, hoursToKickoff],
  )

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>
}

export function useHub(): HubValue {
  const value = useContext(HubContext)
  if (!value) throw new Error('useHub must be used inside <DataHubProvider>')
  return value
}

/** Read one slice and make sure it is being loaded. */
export function useSlice<K extends HubKey>(key: K, enabled = true): HubShape[K] {
  const { hub, ensure } = useHub()
  useEffect(() => {
    if (enabled) void ensure(key)
  }, [enabled, ensure, key])
  return hub[key]
}

/**
 * The cup list the Fortnite module and RonalJarvis agree on: real windows when
 * a key is configured and the service answered, the labelled estimate
 * otherwise.
 */
export function resolveCups(live: LiveCup[] | null | undefined, now = new Date()) {
  if (live && live.length) {
    const ms = now.getTime()
    return {
      source: 'live' as const,
      live: live.filter((c) => c.start.getTime() <= ms && c.end.getTime() >= ms),
      upcoming: live.filter((c) => c.start.getTime() > ms),
    }
  }
  const schedule = getCupSchedule(now, ['EU'])
  return { source: 'estimate' as const, live: schedule.live, upcoming: schedule.upcoming }
}
