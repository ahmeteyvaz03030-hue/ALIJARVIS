import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useStats, useSystem } from '../state/SystemProvider'
import { useHub, useSlice, resolveCups } from '../state/DataHub'
import { useWatchlist } from '../state/useWatchlist'
import { PHASE_LABEL, TRIP } from '../lib/config'
import { useCountdown } from '../lib/hooks'
import { MODE_PRIORITY, MODE_SPEC, EMERGENCY_CONTACTS } from '../lib/jarvisModes'
import { CLUB, isBesiktas } from '../lib/football'
import { JarvisCore } from '../components/core/JarvisCore'
import { HoloCard } from '../components/hud/HoloCard'
import { SegmentBar, StatusPill } from '../components/hud/Readout'
import { JarvisChat } from '../components/jarvis/JarvisChat'
import { BriefingCard } from '../components/jarvis/BriefingCard'
import { SystemLog } from '../components/sim/SystemLog'
import { SystemMonitor } from '../components/sim/SystemMonitor'
import { Radar } from '../components/sim/Radar'
import { WeatherPanel } from '../components/weather/WeatherPanel'
import { Countdown } from '../components/travel/Countdown'
import { POIS, KIND_TONE } from '../data/marmaris'
import type { JarvisSession } from '../lib/auth'
import { EASE } from '../lib/motion'

/* -------------------------------------------------------------------------- */
/* Situational cards                                                          */
/* -------------------------------------------------------------------------- */

const clock = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

function relativeDay(d: Date): string {
  const now = Date.now()
  if (d.toDateString() === new Date(now).toDateString()) return 'heute'
  if (d.toDateString() === new Date(now + 86_400_000).toDateString()) return 'morgen'
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) return 'gestern'
  const days = Math.round((d.getTime() - now) / 86_400_000)
  if (days === 0) return d.getTime() > now ? 'gleich' : 'gerade eben'
  return days > 0 ? `in ${days} Tagen` : `vor ${Math.abs(days)} Tagen`
}

function BesiktasCard({ index, onOpen }: { index: number; onOpen: () => void }) {
  const slice = useSlice('football')
  const next = slice.data?.next.find((f) => f.kickoff) ?? slice.data?.next[0] ?? null
  const row = slice.data?.table.find((r) => isBesiktas(r.team)) ?? null

  return (
    <HoloCard
      index={index}
      tone="cyan"
      title="Beşiktaş"
      status={row ? `PLATZ ${row.rank}` : 'BJK'}
      className="lg:col-span-4"
      scan
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden="true">
            {CLUB.crest}
          </span>
          <div className="min-w-0">
            <div className="font-display text-[0.86rem] font-black tracking-[0.06em] text-ice">
              {CLUB.name}
            </div>
            <div className="font-mono text-[0.52rem] tracking-[0.12em] text-cyan/45">
              {row ? `${row.points} Punkte · ${row.played} Spiele` : slice.error ?? 'lädt...'}
            </div>
          </div>
        </div>

        {next && (
          <div className="mt-3 border-t border-cyan/12 pt-3">
            <div className="hud-label mb-1">Nächstes Spiel</div>
            <div className="font-display text-[0.78rem] font-bold text-ice">
              {next.home} <span className="text-cyan/35">vs</span> {next.away}
            </div>
            <div className="mt-1.5">
              <StatusPill tone="amber" pulse>
                {next.kickoff ? `${relativeDay(next.kickoff)} · ${clock(next.kickoff)}` : next.dateLabel}
              </StatusPill>
            </div>
          </div>
        )}
      </button>
    </HoloCard>
  )
}

function FortniteCard({ index, onOpen }: { index: number; onOpen: () => void }) {
  const { settings } = useSystem()
  const fortnite = useSlice('fortnite')
  const player = useSlice('player', Boolean(settings.fortniteApiKey && settings.epicName))
  const cups = resolveCups(fortnite.data?.cups)
  const nextCup = cups.live[0] ?? cups.upcoming[0] ?? null
  const overall = player.data?.overall ?? null

  return (
    <HoloCard
      index={index}
      tone="violet"
      title="Fortnite"
      status={cups.source === 'live' ? 'LIVE' : 'SCHÄTZUNG'}
      className="lg:col-span-4"
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ['SIEGE', overall ? overall.wins.toLocaleString('de-DE') : '—'],
            ['K/D', overall ? overall.kd.toFixed(2) : '—'],
            ['WIN-RATE', overall ? `${overall.winRate.toFixed(1)}%` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="border border-violet/14 bg-violet/[0.05] px-2 py-1.5">
              <div className="hud-label text-[0.42rem]">{k}</div>
              <div className="font-display text-[0.95rem] font-black tabular-nums text-ice">{v}</div>
            </div>
          ))}
        </div>

        {nextCup ? (
          <div className="mt-3 border-t border-violet/12 pt-3">
            <div className="hud-label mb-1">
              {cups.live.length ? 'Läuft gerade' : 'Nächster Cup'}
            </div>
            <div className="font-display text-[0.76rem] font-bold text-ice">{nextCup.name}</div>
            <div className="font-mono text-[0.52rem] tracking-[0.1em] text-violet/70">
              {relativeDay(nextCup.start)} · {clock(nextCup.start)}
            </div>
          </div>
        ) : (
          <p className="mt-3 border-t border-violet/12 pt-3 text-[0.74rem] text-ice/50">
            Kein Cup angesetzt.
          </p>
        )}

        {!overall && (
          <p className="mt-2 font-mono text-[0.52rem] leading-relaxed text-cyan/35">
            {player.error ?? 'Epic-Namen im Tracker hinterlegen für eigene Zahlen.'}
          </p>
        )}
      </button>
    </HoloCard>
  )
}

function MoviesCard({ index, onOpen }: { index: number; onOpen: () => void }) {
  const { settings } = useSystem()
  const watchlist = useWatchlist()
  const releases = useSlice('releases', Boolean(settings.tmdbApiKey))

  return (
    <HoloCard
      index={index}
      tone="amber"
      title="Entertainment"
      status={`${watchlist.entries.length} GEMERKT`}
      className="lg:col-span-4"
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        {watchlist.entries.length ? (
          <div className="space-y-1">
            {watchlist.entries.slice(0, 4).map((e) => (
              <div key={e.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.78rem] text-ice/85">{e.title}</span>
                <span className="shrink-0 font-mono text-[0.52rem] text-amber/70">
                  {e.mediaType === 'tv' ? 'SERIE' : 'FILM'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.76rem] leading-relaxed text-ice/55">
            Noch nichts gemerkt. Im Entertainment-Modul legt das ★ auf jedem Poster Titel hier ab.
          </p>
        )}

        <div className="mt-3 border-t border-amber/12 pt-3 font-mono text-[0.55rem] tracking-[0.1em] text-cyan/45">
          {releases.data
            ? `${releases.data.nowPlaying.length} IM KINO · ${releases.data.upcoming.length} ANGEKÜNDIGT`
            : (releases.error ?? 'OFFLINE-BIBLIOTHEK AKTIV')}
        </div>
      </button>
    </HoloCard>
  )
}

function EmergencyCard({ index }: { index: number }) {
  return (
    <HoloCard
      index={index}
      tone="danger"
      title="Notfall"
      status="KONTAKTE"
      className="lg:col-span-5"
      scan
    >
      <p className="mb-3 text-[0.76rem] leading-relaxed text-ice/65">
        Diese Nummern gelten auch ohne Guthaben und ohne Netz des eigenen Anbieters. Reisedaten
        stehen darunter, falls sie jemand vorlesen muss.
      </p>
      <div className="space-y-1.5">
        {EMERGENCY_CONTACTS.map((c) => (
          <a
            key={c.label + c.value}
            href={`tel:${c.value.replace(/\s/g, '')}`}
            className="flex items-baseline justify-between gap-3 border border-danger/18 bg-danger/[0.05] px-2.5 py-1.5 transition-colors hover:border-danger/45"
          >
            <span className="min-w-0">
              <span className="block truncate text-[0.76rem] text-ice/85">{c.label}</span>
              <span className="block font-mono text-[0.5rem] tracking-[0.08em] text-cyan/40">
                {c.hint}
              </span>
            </span>
            <span className="shrink-0 font-display text-[0.8rem] font-black tabular-nums text-danger">
              {c.value}
            </span>
          </a>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-danger/12 pt-3 text-[0.72rem] text-ice/70">
        <span>Flug: {TRIP.flightNumber}</span>
        <span>Sitz: {TRIP.seat}</span>
        <span>Gate: {TRIP.gate} · T{TRIP.terminal}</span>
        <span>Rückflug: {TRIP.returnFlight.toLocaleDateString('de-DE')}</span>
      </div>
    </HoloCard>
  )
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

interface Card {
  id: string
  node: ReactNode
}

export function HomeView({
  session,
  unread = 0,
  onNavigate,
}: {
  session: JarvisSession
  unread?: number
  onNavigate?: (view: string) => void
}) {
  const { phase, calm } = useSystem()
  const { mode } = useHub()
  const countdown = useCountdown(TRIP.departure)
  const flightMode = phase === 'flight_day' || phase === 'in_flight'
  const go = (view: string) => onNavigate?.(view)

  /* Every card is built once; the mode only decides the order. Rebuilding the
     dashboard per mode would remount panels on every sunset. */
  const cards: Card[] = [
    {
      id: 'core',
      node: (
        <HoloCard
          key="core"
          index={0}
          tone="cyan"
          className="lg:col-span-5"
          bodyClassName="p-0"
          title="RonalJarvis Core"
          status="ACTIVE"
          scan
          flat
        >
          <div className="flex flex-col items-center px-4 pb-6 pt-3">
            <JarvisCore size={268} caption="RJV CORE // ALI-PRIME" />

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: EASE.out }}
              className="mt-6 text-center"
            >
              <div className="hud-label mb-1">Operator</div>
              <div className="font-display text-xl font-black tracking-[0.2em] text-ice text-glow">
                {session.displayName}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <StatusPill tone="lime">{session.accessLevel}</StatusPill>
                <StatusPill tone={flightMode ? 'amber' : 'cyan'}>{PHASE_LABEL[phase]}</StatusPill>
                <StatusPill tone="violet">{MODE_SPEC[mode].label}</StatusPill>
              </div>
            </motion.div>

            <CoreVitals />
          </div>
        </HoloCard>
      ),
    },
    {
      id: 'countdown',
      node: (
        <HoloCard
          key="countdown"
          index={1}
          tone={flightMode ? 'amber' : 'cyan'}
          title={flightMode ? 'Departure Imminent' : 'Mission Countdown'}
          status={TRIP.flightNumber}
          className="lg:col-span-7"
          scan
        >
          <div className="py-2">
            <Countdown size={flightMode ? 'xl' : 'lg'} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-cyan/10 pt-3 sm:grid-cols-4">
            {[
              ['ABFLUG', TRIP.departure.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
              ['ANKUNFT', TRIP.arrival.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
              ['GATE', `${TRIP.gate} · T${TRIP.terminal}`],
              ['SITZ', TRIP.seat],
            ].map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.07, duration: 0.4 }}
              >
                <div className="hud-label mb-0.5">{k}</div>
                <div className="font-display text-[0.76rem] font-bold tracking-[0.06em] text-ice">
                  {v}
                </div>
              </motion.div>
            ))}
          </div>
        </HoloCard>
      ),
    },
    {
      id: 'briefing',
      node: (
        <BriefingCard
          key="briefing"
          index={2}
          unread={unread}
          className="lg:col-span-5"
          onAsk={() => go('')}
        />
      ),
    },
    {
      id: 'dialogue',
      node: (
        <HoloCard
          key="dialogue"
          index={3}
          tone="cyan"
          title="Core Dialogue"
          status="ONLINE"
          className="lg:col-span-7"
          bodyClassName="p-4"
        >
          <JarvisChat unread={unread} onNavigate={onNavigate} />
        </HoloCard>
      ),
    },
    { id: 'besiktas', node: <BesiktasCard key="besiktas" index={4} onOpen={() => go('besiktas')} /> },
    { id: 'fortnite', node: <FortniteCard key="fortnite" index={5} onOpen={() => go('fortnite')} /> },
    { id: 'movies', node: <MoviesCard key="movies" index={6} onOpen={() => go('movies')} /> },
    {
      id: 'monitor',
      node: (
        <div key="monitor" className="lg:col-span-4">
          <SystemMonitor index={7} />
        </div>
      ),
    },
    {
      id: 'weather',
      node: (
        <div key="weather" className="lg:col-span-4">
          <WeatherPanel index={8} />
        </div>
      ),
    },
    {
      id: 'radar',
      node: (
        <HoloCard
          key="radar"
          index={9}
          tone="lime"
          title="Marmaris Area Scan"
          status="SWEEP"
          className="lg:col-span-4"
          bodyClassName="p-4"
        >
          <Radar
            markers={POIS.slice(0, 5).map((p) => ({
              label: p.short,
              angle: p.bearing,
              dist: p.radar,
              tone: KIND_TONE[p.kind],
            }))}
            size={210}
            label="RANGE 45 KM"
          />
          <div className="mt-4 space-y-1.5 border-t border-cyan/10 pt-3">
            {POIS.slice(0, 3).map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.35 }}
                className="flex items-center justify-between gap-2 font-mono text-[0.6rem]"
              >
                <span className="truncate text-cyan/70">{p.name}</span>
                <span className="shrink-0 tabular-nums text-ice/70">
                  {p.distanceKm.toFixed(1)} KM
                </span>
              </motion.div>
            ))}
          </div>
        </HoloCard>
      ),
    },
    {
      id: 'log',
      node: (
        <div key="log" className="lg:col-span-8">
          <SystemLog index={10} visibleCount={7} />
        </div>
      ),
    },
    {
      id: 'digest',
      node: (
        <HoloCard
          key="digest"
          index={11}
          tone="violet"
          title="Mission Digest"
          status="AUTO"
          className="lg:col-span-4"
        >
          <ul className="space-y-2.5 text-[0.8rem] leading-relaxed text-ice/75">
            {[
              `Countdown bei T–${countdown.days} Tagen, ${String(countdown.hours).padStart(2, '0')} Stunden.`,
              `Route ${TRIP.distanceKm} km, Flugzeit ca. ${Math.round(
                (TRIP.arrival.getTime() - TRIP.departure.getTime()) / 3_600_000,
              )} h.`,
              `Interface im ${MODE_SPEC[mode].label} — ${MODE_SPEC[mode].hint}`,
              'Privater Kanal zu Tony verschlüsselt und aktiv.',
            ].map((line, i) => (
              <motion.li
                key={line}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.09, duration: 0.4 }}
                className="flex gap-2"
              >
                <motion.span
                  className="mt-1.5 h-1 w-1 shrink-0 rotate-45 bg-violet"
                  animate={calm ? undefined : { opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
                />
                <span>{line}</span>
              </motion.li>
            ))}
          </ul>
        </HoloCard>
      ),
    },
  ]

  if (mode === 'emergency') {
    cards.unshift({ id: 'emergency', node: <EmergencyCard key="emergency" index={0} /> })
  }

  const priority = MODE_PRIORITY[mode]
  const ordered = [...cards].sort((a, b) => {
    const ai = priority.indexOf(a.id)
    const bi = priority.indexOf(b.id)
    // Cards the mode doesn't name keep their natural order, behind the ones it does.
    return (ai < 0 ? priority.length : ai) - (bi < 0 ? priority.length : bi)
  })

  return (
    // items-start: cards keep their own height instead of stretching to the
    // tallest one in the row, which left a card like the countdown with a big
    // empty tail whenever it shared a row with the core.
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      {ordered.map((card) => card.node)}
    </div>
  )
}

/** The only part of the home view that follows the 1.8 s telemetry tick. */
function CoreVitals() {
  const stats = useStats()
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.6, ease: EASE.out }}
      className="mt-6 w-full max-w-sm space-y-2.5 border-t border-cyan/10 pt-4"
    >
      {[
        { k: 'HEURISTICS', v: `${stats.cpu}%`, bar: stats.cpu, tone: 'cyan' as const },
        { k: 'MEMORY SHARDS', v: `${stats.memory}%`, bar: stats.memory, tone: 'cyan' as const },
        { k: 'UPLINK', v: `${stats.uplink}%`, bar: stats.uplink, tone: 'lime' as const },
      ].map((row) => (
        <div key={row.k} className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="hud-label">{row.k}</span>
            <span className="font-mono text-[0.62rem] tabular-nums text-ice/75">{row.v}</span>
          </div>
          <SegmentBar value={row.bar} segments={20} tone={row.tone} />
        </div>
      ))}

      <div className="flex items-center justify-between pt-1.5 font-mono text-[0.55rem] tracking-[0.16em] text-cyan/40">
        <span>CORE TEMP {stats.coreTemp}°C</span>
        <span>PING {stats.ping} MS</span>
        <span className="jv-blink">● LIVE</span>
      </div>
    </motion.div>
  )
}
