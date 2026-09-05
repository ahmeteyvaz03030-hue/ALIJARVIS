import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useCountdown } from '../lib/hooks'
import { EASE, seeded } from '../lib/motion'
import {
  fetchActivePlaylists,
  fetchBrNews,
  fetchCosmeticArt,
  fetchStatus,
  type FortniteArt,
  type FortniteNewsItem,
  type FortnitePlaylist,
} from '../lib/fortnite'
import {
  getCupSchedule,
  REGIONS,
  REGION_LABEL,
  type CupEvent,
  type Region,
} from '../lib/fortniteCups'
import { HoloCard } from '../components/hud/HoloCard'
import { StatusPill } from '../components/hud/Readout'

const WEEKDAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

const timeLabel = (d: Date) =>
  `${WEEKDAY[d.getDay()]} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`

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
  const rand = seeded(key.length * 977 + key.charCodeAt(0))
  const hue = Math.floor(rand() * 360)
  return `linear-gradient(150deg, hsl(${hue} 70% 45%), hsl(${(hue + 60) % 360} 75% 30%))`
}

function CupCard({
  event,
  now,
  live,
  art,
  index,
}: {
  event: CupEvent
  now: number
  live: boolean
  art: FortniteArt[]
  index: number
}) {
  const skin = artFor(art, event.templateId + event.region)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4, ease: EASE.out }}
      className="panel-cut-sm relative overflow-hidden border border-violet/20 bg-void/60"
    >
      <div
        className="relative h-32 overflow-hidden"
        style={skin ? undefined : { background: fallbackGradient(event.templateId) }}
      >
        {skin && (
          <img
            src={skin.image}
            alt={skin.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent" />
        {live ? (
          <span className="absolute left-2 top-2 bg-danger px-1.5 py-0.5 font-display text-[0.5rem] font-black tracking-[0.14em] text-void">
            LIVE
          </span>
        ) : (
          <span className="absolute left-2 top-2 border border-cyan/40 bg-void/80 px-1.5 py-0.5 font-mono text-[0.5rem] tracking-[0.12em] text-cyan/85">
            {timeUntil(event.start, now)}
          </span>
        )}
        <span className="absolute right-2 top-2 border border-violet/40 bg-void/80 px-1.5 py-0.5 font-display text-[0.46rem] font-bold tracking-[0.14em] text-violet">
          {event.region}
        </span>
      </div>

      <div className="p-2.5">
        <div className="font-display text-[0.66rem] font-black leading-tight tracking-[0.04em] text-ice">
          {event.name}
        </div>
        <div className="mt-1 font-mono text-[0.5rem] tracking-[0.1em] text-cyan/50">
          {event.format}
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[0.52rem] text-cyan/40">
          <span>{timeLabel(event.start)}</span>
          <span className="text-violet/70">{event.prize}</span>
        </div>
      </div>
    </motion.div>
  )
}

export function FortniteView() {
  const { calm } = useSystem()
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('checking')
  const [playlists, setPlaylists] = useState<FortnitePlaylist[] | null>(null)
  const [news, setNews] = useState<FortniteNewsItem[] | null>(null)
  const [art, setArt] = useState<FortniteArt[]>([])
  const [regions, setRegions] = useState<Region[]>(['EU'])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    void fetchStatus().then((r) => setStatus(r.ok ? (r.data.online ? 'online' : 'offline') : 'unknown'))
    void fetchActivePlaylists().then((r) => setPlaylists(r.ok ? r.data : []))
    void fetchBrNews().then((r) => setNews(r.ok ? r.data : []))
    void fetchCosmeticArt().then(setArt)
  }, [])

  const { live, upcoming } = useMemo(
    () => getCupSchedule(new Date(now), regions),
    [now, regions],
  )
  const countdown = useCountdown(upcoming[0]?.start ?? new Date(now))

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* ------------------------------------------------------------ status */}
      <HoloCard
        index={0}
        tone="violet"
        title="Fortnite Tracker"
        status={status === 'checking' ? 'PRÜFE...' : status.toUpperCase()}
        className="lg:col-span-4"
        scan
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="hud-label">Server</span>
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

          {upcoming[0] && (
            <div className="border-t border-violet/12 pt-3">
              <div className="hud-label mb-1.5">Nächster Cup · {upcoming[0].region}</div>
              <div className="font-display text-[0.78rem] font-bold text-ice">{upcoming[0].name}</div>
              <div className="mt-2 flex items-baseline gap-1 font-display font-black tabular-nums text-violet">
                <span className="text-lg">{countdown.days}</span>
                <span className="text-[0.6rem] text-violet/60">T</span>
                <span className="text-lg">{String(countdown.hours).padStart(2, '0')}</span>
                <span className="text-[0.6rem] text-violet/60">H</span>
                <span className="text-lg">{String(countdown.minutes).padStart(2, '0')}</span>
                <span className="text-[0.6rem] text-violet/60">M</span>
              </div>
            </div>
          )}

          <div className="border-t border-violet/12 pt-3">
            <div className="hud-label mb-2">Regionen</div>
            <div className="flex flex-wrap gap-1">
              {REGIONS.map((r) => {
                const on = regions.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setRegions((prev) =>
                        prev.includes(r)
                          ? prev.length > 1
                            ? prev.filter((x) => x !== r)
                            : prev
                          : [...prev, r],
                      )
                    }
                    title={REGION_LABEL[r]}
                    className="border px-1.5 py-0.5 font-display text-[0.48rem] font-bold tracking-[0.12em] transition-colors"
                    style={{
                      borderColor: on ? 'rgba(169,123,255,0.7)' : 'rgba(53,230,255,0.18)',
                      color: on ? '#a97bff' : 'rgba(53,230,255,0.45)',
                      background: on ? 'rgba(169,123,255,0.1)' : 'transparent',
                    }}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </HoloCard>

      {/* ------------------------------------------------------------- live */}
      <HoloCard
        index={1}
        tone={live.length ? 'lime' : 'cyan'}
        title="Läuft gerade"
        status={`${live.length}`}
        className="lg:col-span-8"
      >
        {live.length === 0 ? (
          <p className="py-6 text-[0.78rem] leading-relaxed text-ice/55">
            In {regions.join(', ')} läuft gerade kein Cup. Der nächste steht links im Countdown.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {live.map((event, i) => (
              <CupCard key={event.id} event={event} now={now} live art={art} index={i} />
            ))}
          </div>
        )}
      </HoloCard>

      {/* --------------------------------------------------------- upcoming */}
      <HoloCard
        index={2}
        tone="violet"
        title="Anstehende Cups"
        status="SCHÄTZUNG"
        className="lg:col-span-8"
      >
        <p className="mb-3 text-[0.72rem] leading-relaxed text-cyan/50">
          Epic bietet keine öffentliche Live-Schnittstelle für Turnier-Termine an. Dieser Plan
          rechnet die echten Cup-Formate auf ihren üblichen Wochenrhythmus und die realen
          Regionszeiten hoch — als Orientierung, nicht als offizieller Zeitplan.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {upcoming.map((event, i) => (
            <CupCard key={event.id} event={event} now={now} live={false} art={art} index={i} />
          ))}
        </div>
      </HoloCard>

      {/* -------------------------------------------------- modes + news */}
      <div className="grid grid-cols-1 gap-3 lg:col-span-4">
        <HoloCard
          index={3}
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
          index={4}
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
  )
}
