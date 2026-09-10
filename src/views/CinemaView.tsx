import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem, type CinemaConfig } from '../state/SystemProvider'
import { useSlice } from '../state/DataHub'
import { useOwnerFeed } from '../state/useOwnerFeed'
import { posterUrl } from '../lib/tmdb'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { StatusPill } from '../components/hud/Readout'

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Without a configured page, send Ali to a search rather than a guessed URL. */
function programmeUrl(cinema: CinemaConfig): string {
  if (cinema.url.trim()) return cinema.url.trim()
  const query = encodeURIComponent(`${cinema.name} ${cinema.city} Kinoprogramm`)
  return `https://duckduckgo.com/?q=${query}`
}

const dateTime = (at: number) =>
  new Date(at).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

function until(target: number, now: number): string {
  const ms = target - now
  if (ms <= 0) return 'LÄUFT / VORBEI'
  const mins = Math.floor(ms / 60_000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `IN ${days} T ${hours} H`
  if (hours > 0) return `IN ${hours} H ${mins % 60} MIN`
  return `IN ${mins} MIN`
}

/* -------------------------------------------------------------------------- */
/* Cinema settings                                                            */
/* -------------------------------------------------------------------------- */

function CinemaEditor({ onClose }: { onClose: () => void }) {
  const { settings, patchSettings, cue } = useSystem()
  const cinema = settings.cinema
  const patch = (changes: Partial<CinemaConfig>) =>
    patchSettings({ cinema: { ...cinema, ...changes } })

  const [priceLabel, setPriceLabel] = useState('')
  const [priceValue, setPriceValue] = useState('')

  const addPrice = () => {
    if (!priceLabel.trim() || !priceValue.trim()) return
    patch({ prices: [...cinema.prices, { label: priceLabel.trim(), value: priceValue.trim() }] })
    setPriceLabel('')
    setPriceValue('')
    cue('confirm')
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: EASE.out }}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-2 border-t border-amber/12 pt-3 sm:grid-cols-2">
        {(
          [
            ['name', 'Kino'],
            ['city', 'Stadt'],
            ['address', 'Adresse'],
            ['phone', 'Telefon'],
            ['url', 'Programm-Seite (URL)'],
          ] as Array<[keyof CinemaConfig, string]>
        ).map(([key, label]) => (
          <div key={key}>
            <label className="hud-label mb-1 block" htmlFor={`cinema-${key}`}>
              {label}
            </label>
            <input
              id={`cinema-${key}`}
              value={String(cinema[key] ?? '')}
              onChange={(e) => patch({ [key]: e.target.value } as Partial<CinemaConfig>)}
              className="hud-input text-left text-[0.8rem]"
              style={{ letterSpacing: 'normal' }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-amber/12 pt-3">
        <div className="hud-label mb-1.5">Preise — so wie sie beim Kino stehen</div>
        {cinema.prices.length > 0 && (
          <div className="mb-2 space-y-1">
            {cinema.prices.map((p, i) => (
              <div key={`${p.label}-${i}`} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[0.76rem] text-ice/80">{p.label}</span>
                <span className="font-display text-[0.76rem] font-bold text-amber">{p.value}</span>
                <button
                  type="button"
                  onClick={() => patch({ prices: cinema.prices.filter((_, j) => j !== i) })}
                  aria-label="Preis entfernen"
                  className="font-mono text-[0.6rem] text-cyan/30 hover:text-danger"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
            placeholder="z. B. Erwachsene 2D"
            className="hud-input min-w-0 flex-1 text-left text-[0.8rem]"
            style={{ letterSpacing: 'normal' }}
          />
          <input
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            placeholder="11,50 €"
            className="hud-input w-28 text-left text-[0.8rem]"
            style={{ letterSpacing: 'normal' }}
          />
          <HudButton small variant="ghost" onClick={addPrice}>
            Hinzufügen
          </HudButton>
        </div>
      </div>

      <div className="mt-3">
        <HudButton small variant="primary" onClick={onClose}>
          Fertig
        </HudButton>
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

export function CinemaView() {
  const { settings, calm } = useSystem()
  const cinema = settings.cinema
  const feed = useOwnerFeed(true)
  const releases = useSlice('releases', Boolean(settings.tmdbApiKey))
  const [editing, setEditing] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const showings = feed.messages
    .filter((m) => m.kind === 'cinema' && m.event)
    .sort((a, b) => (a.event?.startsAt ?? 0) - (b.event?.startsAt ?? 0))
  const upcoming = showings.filter((m) => (m.event?.startsAt ?? 0) + 3 * 3_600_000 > now)
  const nowPlaying = releases.data?.nowPlaying ?? []

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      {/* ------------------------------------------------------------- cinema */}
      <HoloCard
        index={0}
        tone="amber"
        title={cinema.name || 'Kino'}
        status={cinema.city.toUpperCase() || 'KINO'}
        className="lg:col-span-5"
        scan
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">
              🎟️
            </span>
            <div className="min-w-0">
              <div className="font-display text-[0.95rem] font-black tracking-[0.06em] text-ice">
                {cinema.name}
              </div>
              <div className="font-mono text-[0.55rem] tracking-[0.12em] text-cyan/45">
                {cinema.address || cinema.city || 'Adresse noch nicht eingetragen'}
              </div>
            </div>
          </div>

          {cinema.phone && (
            <a
              href={`tel:${cinema.phone.replace(/\s/g, '')}`}
              className="block font-mono text-[0.7rem] tracking-[0.08em] text-amber/80 hover:text-amber"
            >
              ☎ {cinema.phone}
            </a>
          )}

          <div className="flex flex-wrap gap-2 border-t border-amber/12 pt-3">
            <a
              href={programmeUrl(cinema)}
              target="_blank"
              rel="noreferrer noopener"
              className="hud-btn hud-btn-primary px-3 py-1.5 text-[0.58rem] tracking-[0.18em]"
            >
              Programm & Tickets öffnen
            </a>
            <HudButton small variant="ghost" onClick={() => setEditing((e) => !e)}>
              {editing ? 'Schließen' : 'Kino bearbeiten'}
            </HudButton>
          </div>

          {!cinema.url.trim() && (
            <p className="border-l-2 border-amber/50 pl-2.5 text-[0.7rem] leading-relaxed text-amber/70">
              Die offizielle Programmseite ist noch nicht hinterlegt — der Knopf öffnet solange
              eine Suche. Trag die Adresse einmal ein, dann geht er direkt dorthin.
            </p>
          )}

          {cinema.prices.length > 0 ? (
            <div className="border-t border-amber/12 pt-3">
              <div className="hud-label mb-1.5">Preise</div>
              <div className="space-y-1">
                {cinema.prices.map((p, i) => (
                  <div key={`${p.label}-${i}`} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[0.76rem] text-ice/75">{p.label}</span>
                    <span className="shrink-0 font-display text-[0.78rem] font-bold text-amber">
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[0.48rem] leading-relaxed text-cyan/30">
                Selbst eingetragen — im Zweifel beim Kino prüfen.
              </p>
            </div>
          ) : (
            <p className="border-t border-amber/12 pt-3 text-[0.72rem] leading-relaxed text-ice/50">
              Keine Preise hinterlegt. RonalJarvis rät sie bewusst nicht — trag sie einmal so
              ein, wie sie beim Kino aushängen.
            </p>
          )}

          {editing && <CinemaEditor onClose={() => setEditing(false)} />}
        </div>
      </HoloCard>

      {/* ----------------------------------------------------------- showings */}
      <HoloCard
        index={1}
        tone="violet"
        title="Unsere Kinotermine"
        status={`${upcoming.length}`}
        className="lg:col-span-7"
      >
        {upcoming.length === 0 ? (
          <p className="py-4 text-[0.78rem] leading-relaxed text-ice/55">
            Noch kein Termin geplant. Sobald ein Kinobesuch über den Direktkanal reinkommt,
            steht er hier mit Uhrzeit, Platz und Trailer.
          </p>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: EASE.out }}
                className="flex gap-3 border border-violet/20 bg-violet/[0.04] p-2.5"
              >
                {m.film?.posterUrl && (
                  <img
                    src={m.film.posterUrl}
                    alt=""
                    loading="lazy"
                    className="h-28 w-20 shrink-0 border border-cyan/20 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[0.88rem] font-black text-ice">
                    {m.film?.title ?? 'Kinobesuch'}
                  </div>
                  {m.text && (
                    <p className="mt-1 text-[0.74rem] leading-snug text-ice/60">{m.text}</p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {[
                      ['WANN', m.event ? dateTime(m.event.startsAt) : '—'],
                      ['WO', m.event?.place ?? '—'],
                      ...(m.event?.seat ? [['PLATZ', m.event.seat]] : []),
                      ...(m.event?.price ? [['PREIS', m.event.price]] : []),
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="hud-label text-[0.42rem]">{k}</div>
                        <div className="font-display text-[0.7rem] font-bold leading-tight text-ice">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <StatusPill tone="amber" pulse>
                      {m.event ? until(m.event.startsAt, now) : '—'}
                    </StatusPill>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </HoloCard>

      {/* --------------------------------------------------------- orientation */}
      <HoloCard
        index={2}
        tone="cyan"
        title="Läuft gerade in deutschen Kinos"
        status={nowPlaying.length ? `${nowPlaying.length}` : 'TMDB'}
        className="lg:col-span-12"
      >
        <p className="mb-3 border-l-2 border-cyan/40 pl-2.5 text-[0.72rem] leading-relaxed text-cyan/55">
          Das ist der bundesweite Kinostart-Feed von TMDB — eine Orientierung, welche Filme
          gerade laufen könnten, nicht der Spielplan von {cinema.name}. Was dort wirklich läuft,
          steht auf der Programmseite oben.
        </p>

        {nowPlaying.length === 0 ? (
          <p className="py-2 text-[0.76rem] leading-relaxed text-ice/50">
            {releases.error ?? 'Kinostarts werden geladen...'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {nowPlaying.slice(0, 12).map((film, i) => (
              <motion.div
                key={film.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3, ease: EASE.out }}
                className="panel-cut-sm overflow-hidden border border-cyan/15 bg-void/50"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-void">
                  {film.poster_path && (
                    <img
                      src={posterUrl(film.poster_path, 'w342') ?? ''}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {film.vote_average > 0 && (
                    <span className="absolute right-1 top-1 border border-cyan/25 bg-void/80 px-1 font-mono text-[0.48rem] text-ice">
                      ★ {film.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="p-1.5">
                  <div className="truncate font-display text-[0.6rem] font-bold text-ice">
                    {film.title}
                  </div>
                  <div className="font-mono text-[0.45rem] text-cyan/40">
                    {film.release_date?.slice(0, 4) ?? '—'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {calm ? null : (
          <motion.div
            className="mt-3 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </HoloCard>
    </div>
  )
}
