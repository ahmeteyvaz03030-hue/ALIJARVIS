import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useCountdown } from '../lib/hooks'
import { EASE } from '../lib/motion'
import { fetchActivePlaylists, fetchBrNews, fetchStatus, type FortniteNewsItem, type FortnitePlaylist } from '../lib/fortnite'
import { getCupSchedule, type CupEvent } from '../lib/fortniteCups'
import { HoloCard } from '../components/hud/HoloCard'
import { StatusPill } from '../components/hud/Readout'

const WEEKDAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

function formatEventTime(date: Date): string {
  return `${WEEKDAY[date.getDay()]} ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
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

function CupRow({ event, now, live }: { event: CupEvent; now: number; live?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: EASE.out }}
      className="flex items-center justify-between gap-3 border border-violet/14 bg-violet/[0.03] px-3 py-2.5"
    >
      <div className="min-w-0">
        <div className="font-display text-[0.72rem] font-bold tracking-[0.06em] text-ice">{event.name}</div>
        <div className="mt-0.5 font-mono text-[0.55rem] tracking-[0.1em] text-cyan/50">
          {event.format} · {event.region} · {event.prize}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[0.62rem] tabular-nums text-ice/80">{formatEventTime(event.start)}</div>
        <StatusPill tone={live ? 'lime' : 'amber'} pulse={live}>
          {live ? 'LÄUFT' : timeUntil(event.start, now)}
        </StatusPill>
      </div>
    </motion.div>
  )
}

export function FortniteView() {
  const { calm } = useSystem()
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('checking')
  const [playlists, setPlaylists] = useState<FortnitePlaylist[] | null>(null)
  const [news, setNews] = useState<FortniteNewsItem[] | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    void fetchStatus().then((result) => {
      setStatus(result.ok ? (result.data.online ? 'online' : 'offline') : 'unknown')
    })
    void fetchActivePlaylists().then((result) => {
      setPlaylists(result.ok ? result.data : [])
    })
    void fetchBrNews().then((result) => {
      setNews(result.ok ? result.data : [])
    })
  }, [])

  const { live, upcoming } = getCupSchedule(new Date(now))
  // useCountdown must run unconditionally (Rules of Hooks) — fall back to
  // "now" itself when nothing is scheduled, which just renders as all-zero.
  const countdown = useCountdown(upcoming[0]?.start ?? new Date(now))

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
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
              {status === 'checking' ? 'PRÜFE...' : status === 'online' ? 'ONLINE' : status === 'offline' ? 'OFFLINE' : 'UNBEKANNT'}
            </StatusPill>
          </div>
          {upcoming[0] && (
            <div className="border-t border-violet/12 pt-3">
              <div className="hud-label mb-1.5">Nächster Cup</div>
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
        </div>
      </HoloCard>

      <HoloCard
        index={1}
        tone="lime"
        title="Aktive Modi"
        status={playlists === null ? 'LADE...' : `${playlists.length}`}
        className="lg:col-span-8"
      >
        {playlists === null ? (
          <div className="flex items-center gap-3 py-6">
            <motion.div
              className="h-6 w-6 rounded-full border border-lime/25 border-t-lime"
              animate={calm ? undefined : { rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span className="font-mono text-[0.58rem] tracking-[0.2em] text-cyan/45">LADE AKTIVE EVENTS...</span>
          </div>
        ) : playlists.length === 0 ? (
          <p className="py-4 text-[0.78rem] leading-relaxed text-ice/55">
            Aktuell keine gesonderten Event-Playlists gemeldet — oder fortnite-api.com war nicht erreichbar. Die
            regulären Battle-Royale- und Zero-Build-Modi laufen unabhängig davon normal weiter.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {playlists.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: EASE.out }}
                className="border border-lime/16 bg-lime/[0.04] p-2.5"
              >
                <div className="font-display text-[0.7rem] font-bold text-ice">{p.name ?? p.id}</div>
                {p.subName && (
                  <div className="mt-0.5 font-mono text-[0.55rem] tracking-[0.08em] text-lime/70">{p.subName}</div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </HoloCard>

      <HoloCard
        index={2}
        tone="violet"
        title="Cup-Kalender"
        status="BEISPIEL"
        className="lg:col-span-8"
      >
        <p className="mb-3 text-[0.72rem] leading-relaxed text-cyan/50">
          Epic veröffentlicht keine öffentliche Live-Schnittstelle für Cup-Termine — dieser Kalender zeigt reale
          Cup-Formate in einem realistischen wöchentlichen Rhythmus als Orientierung, keine offizielle Live-Daten.
        </p>

        {live.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <div className="hud-label mb-1" style={{ color: 'rgba(124,255,155,0.7)' }}>
              Läuft gerade
            </div>
            {live.map((event) => (
              <CupRow key={`${event.templateId}-${event.start.getTime()}`} event={event} now={now} live />
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="hud-label mb-1">Anstehend</div>
          {upcoming.map((event) => (
            <CupRow key={`${event.templateId}-${event.start.getTime()}`} event={event} now={now} />
          ))}
        </div>
      </HoloCard>

      <HoloCard
        index={3}
        tone="amber"
        title="News"
        status={news === null ? 'LADE...' : `${news.length}`}
        className="lg:col-span-4"
      >
        {news === null ? (
          <div className="py-6 text-center font-mono text-[0.55rem] tracking-[0.2em] text-cyan/40">LADE...</div>
        ) : news.length === 0 ? (
          <p className="py-4 text-[0.76rem] leading-relaxed text-ice/55">
            Keine Neuigkeiten geladen — Netzwerk oder fortnite-api.com prüfen.
          </p>
        ) : (
          <div className="space-y-2.5">
            {news.map((item, i) => (
              <motion.div
                key={item.title + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="border-b border-amber/10 pb-2.5 last:border-b-0"
              >
                <div className="font-display text-[0.68rem] font-bold text-ice">{item.title}</div>
                {item.body && (
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-ice/55">{item.body}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </HoloCard>
    </div>
  )
}
