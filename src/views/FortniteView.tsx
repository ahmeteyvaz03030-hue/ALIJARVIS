import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useCountdown } from '../lib/hooks'
import { EASE, seeded } from '../lib/motion'
import {
  fetchActivePlaylists,
  fetchBrNews,
  fetchCosmeticArt,
  type FortniteArt,
  type FortniteNewsItem,
  type FortnitePlaylist,
} from '../lib/fortnite'
import { fetchLiveCups, lookupPlayer, type LiveCup, type PlayerStats } from '../lib/fortniteEvents'
import {
  getCupSchedule,
  REGIONS,
  REGION_LABEL,
  type Region,
} from '../lib/fortniteCups'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { StatusPill } from '../components/hud/Readout'
import { AimTrainer } from '../components/fortnite/AimTrainer'
import { SensFinder } from '../components/fortnite/SensFinder'
import { useSlice } from '../state/DataHub'

const WEEKDAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

const clock = (d: Date) =>
  d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

const dayLabel = (d: Date, now: number) => {
  const today = new Date(now)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'HEUTE'
  const tomorrow = new Date(now + 86_400_000)
  if (sameDay(d, tomorrow)) return 'MORGEN'
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
}

function timeUntil(date: Date, now: number): string {
  const ms = date.getTime() - now
  if (ms <= 0) return 'JETZT'
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (days > 0) return `IN ${days}T ${hours % 24}H`
  if (hours > 0) return `IN ${hours}H ${mins}M`
  return `IN ${mins}M`
}

/** Stable art per cup so a given cup always wears the same skin. */
function artFor(art: FortniteArt[], key: string): FortniteArt | null {
  if (!art.length) return null
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return art[hash % art.length]
}

/** Deterministic backdrop when no real artwork loaded. */
function fallbackGradient(key: string): string {
  const rand = seeded(key.length * 977 + (key.charCodeAt(0) || 7))
  const hue = Math.floor(rand() * 360)
  return `linear-gradient(150deg, hsl(${hue} 70% 45%), hsl(${(hue + 60) % 360} 75% 30%))`
}

/* -------------------------------------------------------------------------- */
/* One shape for both sources                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Real windows from fortniteapi.io and rows from the generated calendar are
 * rendered by the same card, so both are normalised into this first.
 */
interface DisplayCup {
  id: string
  name: string
  format: string
  region: string
  prize: string
  start: Date
  end: Date
  /** Poster art from Epic, when the live feed supplied one. */
  image: string | null
  /** Stable seed for the fallback skin/gradient. */
  artKey: string
}

function CupCard({
  cup,
  now,
  live,
  art,
  index,
}: {
  cup: DisplayCup
  now: number
  live: boolean
  art: FortniteArt[]
  index: number
}) {
  const skin = cup.image ? null : artFor(art, cup.artKey)
  const image = cup.image ?? skin?.image ?? null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25), duration: 0.35, ease: EASE.out }}
      className="panel-cut-sm relative overflow-hidden border bg-void/60"
      style={{ borderColor: live ? 'rgba(140,255,120,0.35)' : 'rgba(169,123,255,0.2)' }}
    >
      <div
        className="relative h-28 overflow-hidden"
        style={image ? undefined : { background: fallbackGradient(cup.artKey) }}
      >
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent" />
        {live ? (
          <span className="absolute left-2 top-2 bg-lime px-1.5 py-0.5 font-display text-[0.5rem] font-black tracking-[0.14em] text-void">
            LIVE
          </span>
        ) : (
          <span className="absolute left-2 top-2 border border-cyan/40 bg-void/85 px-1.5 py-0.5 font-mono text-[0.5rem] tracking-[0.12em] text-cyan/85">
            {timeUntil(cup.start, now)}
          </span>
        )}
        <span className="absolute right-2 top-2 border border-violet/40 bg-void/85 px-1.5 py-0.5 font-display text-[0.46rem] font-bold tracking-[0.14em] text-violet">
          {cup.region}
        </span>
      </div>

      <div className="p-2.5">
        <div className="font-display text-[0.66rem] font-black leading-tight tracking-[0.04em] text-ice">
          {cup.name}
        </div>
        {cup.format && (
          <div className="mt-1 font-mono text-[0.5rem] tracking-[0.1em] text-cyan/50">
            {cup.format}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 font-mono text-[0.52rem]">
          <span className="whitespace-nowrap text-cyan/60">
            <span className="text-cyan/85">{dayLabel(cup.start, now)}</span> {clock(cup.start)}
            <span className="text-cyan/30"> – {clock(cup.end)}</span>
          </span>
          {cup.prize && <span className="shrink-0 text-violet/70">{cup.prize}</span>}
        </div>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Player tracker                                                             */
/* -------------------------------------------------------------------------- */

const nf = new Intl.NumberFormat('de-DE')

function StatTile({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border border-cyan/12 bg-cyan/[0.03] px-2 py-1.5">
      <div className="hud-label text-[0.44rem]">{label}</div>
      <div
        className="font-display text-[0.9rem] font-black tabular-nums"
        style={{ color: tone === 'lime' ? '#8cff78' : tone === 'violet' ? '#a97bff' : '#d8f6ff' }}
      >
        {value}
      </div>
    </div>
  )
}

function PlayerTracker({ index, apiKey }: { index: number; apiKey: string | null }) {
  const { cue, pushLog, settings, patchSettings } = useSystem()
  const [name, setName] = useState(settings.epicName ?? '')
  const [busy, setBusy] = useState(false)
  const [player, setPlayer] = useState<PlayerStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const auto = useRef(false)

  const run = useCallback(
    async (query: string) => {
      if (!query || !apiKey) return
      setBusy(true)
      setError(null)
      const result = await lookupPlayer(apiKey, query)
      setBusy(false)
      if (result.ok) {
        setPlayer(result.data)
        cue('confirm')
        pushLog(`Spielerprofil geladen: ${result.data.name}`, 'ok')
      } else {
        setPlayer(null)
        setError(result.message)
        cue('deny')
      }
    },
    [apiKey, cue, pushLog],
  )

  // A saved Epic name means Ali shouldn't have to type it again — the panel
  // opens on his own profile and the search bar stays free for other players.
  useEffect(() => {
    if (auto.current || !apiKey || !settings.epicName) return
    auto.current = true
    void run(settings.epicName)
  }, [apiKey, run, settings.epicName])

  const search = () => {
    const query = name.trim()
    if (!query) return
    cue('process')
    void run(query)
  }

  const remember = () => {
    const query = name.trim()
    if (!query) return
    patchSettings({ epicName: query })
    cue('confirm')
    pushLog(`Epic-Name gemerkt: ${query}`, 'ok')
  }

  return (
    <HoloCard
      index={index}
      tone="cyan"
      title="Spieler-Tracker"
      status={player ? player.name.toUpperCase().slice(0, 14) : apiKey ? 'BEREIT' : 'KEIN KEY'}
    >
      {!apiKey ? (
        <p className="py-2 text-[0.74rem] leading-relaxed text-ice/55">
          Für die Spielersuche braucht RonalJarvis einen eigenen fortniteapi.io-Schlüssel — in den
          Einstellungen eintragen, dann lassen sich hier Epic-Namen nachschlagen.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search()
              }}
              placeholder="Epic-Name…"
              spellCheck={false}
              autoComplete="off"
              className="hud-input flex-1 text-left text-[0.78rem]"
              style={{ letterSpacing: 'normal' }}
            />
            <HudButton small variant="primary" busy={busy} onClick={search}>
              Suchen
            </HudButton>
          </div>

          {name.trim() && name.trim() !== settings.epicName && (
            <button
              type="button"
              onClick={remember}
              className="mt-1.5 font-mono text-[0.52rem] tracking-[0.12em] text-cyan/45 hover:text-cyan"
            >
              ★ „{name.trim()}" als meinen Epic-Namen merken
            </button>
          )}

          {error && (
            <p className="mt-3 border border-danger/25 bg-danger/[0.06] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-danger/85">
              {error}
            </p>
          )}

          {player && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE.out }}
              className="mt-3"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-display text-[0.86rem] font-black text-ice">{player.name}</span>
                <span className="font-mono text-[0.5rem] tracking-[0.12em] text-cyan/35">LIFETIME</span>
              </div>

              {player.overall === null ? (
                <p className="text-[0.72rem] leading-relaxed text-ice/55">
                  Dieses Konto hat seine Statistiken auf privat gestellt — Epic gibt dann keine
                  Zahlen heraus.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <StatTile label="SIEGE" value={nf.format(player.overall.wins)} tone="lime" />
                    <StatTile label="K/D" value={player.overall.kd.toFixed(2)} tone="violet" />
                    <StatTile
                      label="WIN-RATE"
                      value={`${player.overall.winRate.toFixed(1)}%`}
                      tone="lime"
                    />
                    <StatTile label="MATCHES" value={nf.format(player.overall.matches)} />
                    <StatTile label="KILLS" value={nf.format(player.overall.kills)} />
                    <StatTile label="TOP 10" value={nf.format(player.overall.top10)} />
                  </div>

                  {player.perMode.length > 0 && (
                    <div className="mt-3 border-t border-cyan/12 pt-2.5">
                      <div className="hud-label mb-1.5">Nach Modus</div>
                      <div className="space-y-1">
                        {player.perMode.slice(0, 6).map((m) => (
                          <div
                            key={m.mode}
                            className="flex items-center justify-between gap-2 font-mono text-[0.56rem]"
                          >
                            <span className="text-ice/70">{m.mode}</span>
                            <span className="tabular-nums text-cyan/50">
                              {nf.format(m.matches)} M · {nf.format(m.wins)} S ·{' '}
                              <span className="text-violet/80">{m.kd.toFixed(2)} K/D</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-3 border-t border-cyan/12 pt-2 font-mono text-[0.5rem] leading-relaxed text-cyan/35">
                    Quelle: fortniteapi.io · öffentliche Epic-Statistiken
                  </p>
                </>
              )}
            </motion.div>
          )}
        </>
      )}
    </HoloCard>
  )
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

type CupFilter = 'all' | 'live' | 'today' | 'week'

const FILTER_LABEL: Record<CupFilter, string> = {
  all: 'ALLE',
  live: 'LÄUFT',
  today: 'HEUTE',
  week: '7 TAGE',
}

type Section = 'cups' | 'player' | 'training'

const SECTION_LABEL: Record<Section, string> = {
  cups: 'Cups & Turniere',
  player: 'Spieler-Tracker',
  training: 'Aim & Sensitivität',
}

const SECTION_ORDER: Section[] = ['cups', 'player', 'training']

export function FortniteView() {
  const { calm, settings } = useSystem()
  const [section, setSection] = useState<Section>('cups')
  const ioKey = settings.fortniteApiKey
  const [playlists, setPlaylists] = useState<FortnitePlaylist[] | null>(null)
  const [news, setNews] = useState<FortniteNewsItem[] | null>(null)
  const [art, setArt] = useState<FortniteArt[]>([])
  const [region, setRegion] = useState<Region>('EU')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CupFilter>('all')
  const [now, setNow] = useState(() => Date.now())
  const [regionCups, setRegionCups] = useState<DisplayCup[] | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)

  // Europe — the default and the only region RonalJarvis needs elsewhere —
  // comes from the shared hub, so the assistant and this panel never disagree
  // and never fetch the same windows twice.
  const fortnite = useSlice('fortnite')
  const status: 'checking' | 'online' | 'offline' | 'unknown' =
    fortnite.status === 'loading' || fortnite.status === 'idle'
      ? 'checking'
      : fortnite.data?.status
        ? fortnite.data.status.online
          ? 'online'
          : 'offline'
        : 'unknown'

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    void fetchActivePlaylists().then((r) => setPlaylists(r.ok ? r.data : []))
    void fetchBrNews().then((r) => setNews(r.ok ? r.data : []))
    void fetchCosmeticArt().then(setArt)
  }, [])

  const toDisplay = useCallback(
    (c: LiveCup): DisplayCup => ({
      id: c.id,
      name: c.shortName || c.name,
      format: c.playlist,
      region: c.region,
      prize: '',
      start: c.start,
      end: c.end,
      image: c.image,
      artKey: c.name + c.region,
    }),
    [],
  )

  // Any region other than Europe is a one-off request outside the hub.
  useEffect(() => {
    if (!ioKey || region === 'EU') {
      setRegionCups(null)
      setLiveError(null)
      return
    }
    let cancelled = false
    void fetchLiveCups(ioKey, region).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setLiveError(null)
        setRegionCups(result.data.map(toDisplay))
      } else {
        setRegionCups(null)
        setLiveError(result.message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [ioKey, region, toDisplay])

  const liveCups: DisplayCup[] | null =
    region === 'EU' ? (fortnite.data?.cups?.map(toDisplay) ?? null) : regionCups

  const estimate = useMemo(() => getCupSchedule(new Date(now), [region]), [now, region])

  // Live data wins when it actually returned windows; otherwise the labelled
  // estimate keeps the panel useful instead of empty.
  const usingLive = liveCups !== null && liveCups.length > 0
  const allCups: DisplayCup[] = useMemo(() => {
    if (usingLive) return liveCups.filter((c) => c.region === region || c.region === '—')
    return [...estimate.live, ...estimate.upcoming].map((e) => ({
      id: e.id,
      name: e.name,
      format: e.format,
      region: e.region,
      prize: e.prize,
      start: e.start,
      end: e.end,
      image: null,
      artKey: e.templateId + e.region,
    }))
  }, [usingLive, liveCups, estimate, region])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)
    const weekAhead = now + 7 * 86_400_000
    return allCups.filter((c) => {
      if (q && !`${c.name} ${c.format} ${c.region} ${c.prize}`.toLowerCase().includes(q)) return false
      const isLive = c.start.getTime() <= now && c.end.getTime() >= now
      if (filter === 'live') return isLive
      if (filter === 'today') return isLive || c.start.getTime() <= endOfToday.getTime()
      if (filter === 'week') return isLive || c.start.getTime() <= weekAhead
      return true
    })
  }, [allCups, query, filter, now])

  const liveNow = filtered.filter((c) => c.start.getTime() <= now && c.end.getTime() >= now)
  const later = filtered.filter((c) => c.start.getTime() > now)
  const nextCup = allCups.find((c) => c.start.getTime() > now) ?? null
  const countdown = useCountdown(nextCup?.start ?? new Date(now))

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------- sections */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SECTION_ORDER.map((id) => (
          <HudButton
            key={id}
            small
            variant={section === id ? 'primary' : 'ghost'}
            onClick={() => setSection(id)}
          >
            {SECTION_LABEL[id]}
          </HudButton>
        ))}
      </div>

      {section === 'cups' && (
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      {/* ------------------------------------------------------------- cups */}
      <HoloCard
        index={0}
        tone="violet"
        title="Cups & Turniere"
        status={usingLive ? 'LIVE' : 'SCHÄTZUNG'}
        className="lg:col-span-8"
        scan
      >
        {/* controls ------------------------------------------------------- */}
        <div className="mb-3 space-y-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cup suchen — z. B. Solo, Cash, Reload…"
              spellCheck={false}
              autoComplete="off"
              className="hud-input pr-16 text-left text-[0.8rem]"
              style={{ letterSpacing: 'normal' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.55rem] tracking-[0.14em] text-cyan/50 hover:text-cyan"
              >
                LEEREN
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex gap-1">
              {(Object.keys(FILTER_LABEL) as CupFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className="border px-2 py-0.5 font-display text-[0.48rem] font-bold tracking-[0.12em] transition-colors"
                  style={{
                    borderColor: filter === f ? 'rgba(169,123,255,0.7)' : 'rgba(53,230,255,0.18)',
                    color: filter === f ? '#a97bff' : 'rgba(53,230,255,0.45)',
                    background: filter === f ? 'rgba(169,123,255,0.1)' : 'transparent',
                  }}
                >
                  {FILTER_LABEL[f]}
                </button>
              ))}
            </div>

            <span className="h-3 w-px bg-cyan/15" />

            <div className="flex flex-wrap gap-1">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  title={REGION_LABEL[r]}
                  className="border px-1.5 py-0.5 font-display text-[0.48rem] font-bold tracking-[0.12em] transition-colors"
                  style={{
                    borderColor: region === r ? 'rgba(53,230,255,0.7)' : 'rgba(53,230,255,0.16)',
                    color: region === r ? '#35e6ff' : 'rgba(53,230,255,0.4)',
                    background: region === r ? 'rgba(53,230,255,0.08)' : 'transparent',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <span className="ml-auto font-mono text-[0.52rem] tracking-[0.12em] text-cyan/35">
              {filtered.length} TREFFER · {REGION_LABEL[region].toUpperCase()}
            </span>
          </div>
        </div>

        {/* source note ---------------------------------------------------- */}
        <p className="mb-3 border-l-2 pl-2.5 text-[0.68rem] leading-relaxed"
          style={{
            borderColor: usingLive ? 'rgba(140,255,120,0.5)' : 'rgba(255,190,80,0.45)',
            color: usingLive ? 'rgba(216,246,255,0.6)' : 'rgba(53,230,255,0.5)',
          }}
        >
          {usingLive ? (
            <>Echte Turnierfenster von fortniteapi.io, gefiltert auf {REGION_LABEL[region]}.</>
          ) : liveError ? (
            <>fortniteapi.io nicht erreichbar ({liveError}) — unten läuft der Schätzkalender.</>
          ) : ioKey ? (
            <>
              fortniteapi.io meldet für {REGION_LABEL[region]} gerade keine Fenster — unten läuft
              der Schätzkalender.
            </>
          ) : (
            <>
              Epic bietet keinen offenen Turnierkalender. Dieser Plan rechnet die echten
              Cup-Formate auf ihren üblichen Wochenrhythmus und die realen Regionszeiten hoch —
              Orientierung, kein offizieller Zeitplan. Mit einem fortniteapi.io-Schlüssel in den
              Einstellungen zeigt RonalJarvis stattdessen die echten Fenster.
            </>
          )}
        </p>

        {/* list ----------------------------------------------------------- */}
        {filtered.length === 0 ? (
          <p className="py-6 text-[0.78rem] leading-relaxed text-ice/55">
            {query
              ? `Kein Cup passt zu „${query}".`
              : `In ${REGION_LABEL[region]} passt gerade kein Cup zu diesem Filter.`}
          </p>
        ) : (
          <div className="space-y-4">
            {liveNow.length > 0 && (
              <section>
                <div className="hud-label mb-2 text-lime/80">Läuft gerade · {liveNow.length}</div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                  {liveNow.map((cup, i) => (
                    <CupCard key={cup.id} cup={cup} now={now} live art={art} index={i} />
                  ))}
                </div>
              </section>
            )}
            {later.length > 0 && (
              <section>
                <div className="hud-label mb-2">Anstehend · {later.length}</div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                  {later.map((cup, i) => (
                    <CupCard key={cup.id} cup={cup} now={now} live={false} art={art} index={i} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </HoloCard>

      {/* ------------------------------------------------------ right column */}
      <div className="grid auto-rows-min grid-cols-1 content-start gap-3 lg:col-span-4">
        <HoloCard
          index={1}
          tone="violet"
          title="Nächster Cup"
          status={status === 'checking' ? 'PRÜFE...' : status.toUpperCase()}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="hud-label">Epic-Server</span>
              <StatusPill
                tone={status === 'online' ? 'lime' : status === 'offline' ? 'danger' : 'cyan'}
                pulse={status === 'online'}
              >
                {status === 'checking'
                  ? 'PRÜFE...'
                  : status === 'online'
                    ? 'ONLINE'
                    : status === 'offline'
                      ? 'OFFLINE'
                      : 'UNBEKANNT'}
              </StatusPill>
            </div>

            {nextCup ? (
              <div className="border-t border-violet/12 pt-3">
                <div className="hud-label mb-1.5">
                  {nextCup.region} · {dayLabel(nextCup.start, now)} {clock(nextCup.start)}
                </div>
                <div className="font-display text-[0.78rem] font-bold text-ice">{nextCup.name}</div>
                <div className="mt-2 flex items-baseline gap-1 font-display font-black tabular-nums text-violet">
                  <span className="text-lg">{countdown.days}</span>
                  <span className="text-[0.6rem] text-violet/60">T</span>
                  <span className="text-lg">{String(countdown.hours).padStart(2, '0')}</span>
                  <span className="text-[0.6rem] text-violet/60">H</span>
                  <span className="text-lg">{String(countdown.minutes).padStart(2, '0')}</span>
                  <span className="text-[0.6rem] text-violet/60">M</span>
                </div>
              </div>
            ) : (
              <p className="border-t border-violet/12 pt-3 text-[0.74rem] leading-relaxed text-ice/55">
                Kein anstehender Cup in {REGION_LABEL[region]}.
              </p>
            )}
          </div>
        </HoloCard>

        <HoloCard
          index={2}
          tone="lime"
          title="Aktive Modi"
          status={playlists === null ? 'LADE...' : `${playlists.length}`}
        >
          {playlists === null ? (
            <div className="flex items-center gap-3 py-4">
              <motion.div
                className="h-5 w-5 rounded-full border border-lime/25 border-t-lime"
                animate={calm ? undefined : { rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <span className="font-mono text-[0.55rem] tracking-[0.18em] text-cyan/45">LADE...</span>
            </div>
          ) : playlists.length === 0 ? (
            <p className="py-2 text-[0.74rem] leading-relaxed text-ice/55">
              Keine gesonderten Event-Playlists gemeldet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {playlists.map((p) => (
                <div key={p.id} className="border border-lime/16 bg-lime/[0.04] px-2.5 py-1.5">
                  <div className="font-display text-[0.64rem] font-bold text-ice">{p.name ?? p.id}</div>
                  {p.subName && (
                    <div className="font-mono text-[0.5rem] tracking-[0.08em] text-lime/70">{p.subName}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </HoloCard>

        <HoloCard
          index={3}
          tone="amber"
          title="News"
          status={news === null ? 'LADE...' : `${news.length}`}
        >
          {news === null ? (
            <div className="py-4 text-center font-mono text-[0.55rem] tracking-[0.18em] text-cyan/40">
              LADE...
            </div>
          ) : news.length === 0 ? (
            <p className="py-2 text-[0.74rem] leading-relaxed text-ice/55">
              Keine Neuigkeiten geladen.
            </p>
          ) : (
            <div className="space-y-2.5">
              {news.map((item, i) => (
                <div key={item.title + i} className="border-b border-amber/10 pb-2.5 last:border-b-0">
                  <div className="font-display text-[0.66rem] font-bold text-ice">{item.title}</div>
                  {item.body && (
                    <p className="mt-1 text-[0.66rem] leading-relaxed text-ice/55">{item.body}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </HoloCard>
      </div>
      </div>
      )}

      {section === 'player' && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <PlayerTracker index={0} apiKey={ioKey} />
          </div>
          <HoloCard
            index={1}
            tone="violet"
            title="Woher die Zahlen kommen"
            status="QUELLE"
            className="lg:col-span-7"
          >
            <p className="text-[0.78rem] leading-relaxed text-ice/65">
              Die Statistiken stammen von fortniteapi.io, das Epics öffentliche Spielerdaten über
              eine dokumentierte Schnittstelle bereitstellt — dieselben Zahlen, die Fortnite
              in-game unter „Karriere" zeigt. Konten, die ihre Statistiken auf privat gestellt
              haben, geben nichts heraus; RonalJarvis sagt dann genau das, statt zu raten.
            </p>
            <ul className="mt-3 space-y-1.5 border-t border-violet/12 pt-3 text-[0.74rem] leading-relaxed text-ice/55">
              <li>· Der Epic-Name lässt sich merken — dann öffnet der Tracker direkt dein Profil.</li>
              <li>· Ranglisten-Punkte und Turnierplatzierungen liegen hinter einem Epic-Login und
                sind hier bewusst nicht enthalten.</li>
              <li>· Frag RonalJarvis „Wie sind meine Fortnite Stats?" — er liest dieselben Daten.</li>
            </ul>
          </HoloCard>
        </div>
      )}

      {section === 'training' && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
          <HoloCard
            index={0}
            tone="lime"
            title="Aim-Training"
            status="DRILLS"
            className="lg:col-span-7"
            scan
          >
            <AimTrainer />
          </HoloCard>

          <HoloCard
            index={1}
            tone="violet"
            title="Find Your Sensitivity"
            status="SENS"
            className="lg:col-span-5"
          >
            <SensFinder />
          </HoloCard>
        </div>
      )}
    </div>
  )
}
