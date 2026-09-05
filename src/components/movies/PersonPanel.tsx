import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useDebouncedValue } from '../../lib/hooks'
import { EASE } from '../../lib/motion'
import {
  fetchPerson,
  searchPeople,
  type TmdbPersonDetail,
  type TmdbPersonSummary,
} from '../../lib/tmdb'
import { HoloCard } from '../hud/HoloCard'
import { HudButton } from '../hud/HudButton'
import { StatusPill } from '../hud/Readout'

function age(birthday: string, deathday: string | null): number {
  const end = deathday ? new Date(deathday) : new Date()
  const born = new Date(birthday)
  let years = end.getFullYear() - born.getFullYear()
  const m = end.getMonth() - born.getMonth()
  if (m < 0 || (m === 0 && end.getDate() < born.getDate())) years--
  return years
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' }) : 'TBA'

export function PersonPanel({ apiKey, index = 0 }: { apiKey: string; index?: number }) {
  const { cue, pushLog } = useSystem()
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 450)
  const [results, setResults] = useState<TmdbPersonSummary[] | null>(null)
  const [person, setPerson] = useState<TmdbPersonDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAllCredits, setShowAllCredits] = useState(false)

  useEffect(() => {
    const term = debounced.trim()
    if (!term) {
      setResults(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void searchPeople(apiKey, term).then((r) => {
      if (cancelled) return
      setLoading(false)
      setResults(r.ok ? r.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [apiKey, debounced])

  const open = async (summary: TmdbPersonSummary) => {
    cue('confirm')
    setLoading(true)
    const detail = await fetchPerson(apiKey, summary.id)
    setLoading(false)
    setShowAllCredits(false)
    if (detail) {
      setPerson(detail)
      pushLog(`Personendossier geöffnet — ${detail.name}`, 'info')
    } else {
      pushLog(`Dossier für ${summary.name} nicht abrufbar`, 'warn')
    }
  }

  const upcoming = person?.credits.filter((c) => c.upcoming) ?? []
  const past = person?.credits.filter((c) => !c.upcoming) ?? []
  const shown = showAllCredits ? past : past.slice(0, 6)

  return (
    <HoloCard index={index} tone="amber" title="Schauspieler-Dossier" status="TMDB">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Schauspieler suchen (z. B. Jason Statham)..."
          aria-label="Schauspieler suchen"
          className="hud-input py-2 pr-9 text-[0.82rem]"
          style={{ letterSpacing: 'normal' }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setPerson(null)
            }}
            aria-label="Suche löschen"
            className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan/50 hover:text-cyan"
          >
            ✕
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-3 font-mono text-[0.58rem] tracking-[0.2em] text-cyan/45">LADE...</div>
      )}

      {/* search results */}
      <AnimatePresence>
        {!person && results && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 space-y-1.5"
          >
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void open(p)}
                className="flex w-full items-center gap-3 border border-amber/14 bg-amber/[0.03] p-2 text-left transition-colors hover:border-amber/45"
              >
                <span className="h-12 w-9 shrink-0 overflow-hidden border border-amber/20 bg-void/60">
                  {p.profileUrl && (
                    <img src={p.profileUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[0.7rem] font-bold text-ice">{p.name}</span>
                  <span className="block truncate font-mono text-[0.55rem] text-cyan/45">
                    {p.knownFor || '—'}
                  </span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!person && results && results.length === 0 && !loading && (
        <div className="mt-3 font-mono text-[0.6rem] tracking-[0.18em] text-cyan/40">
          KEINE TREFFER
        </div>
      )}

      {/* dossier */}
      <AnimatePresence>
        {person && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.out }}
            className="mt-4"
          >
            <div className="flex gap-3">
              <div className="h-32 w-24 shrink-0 overflow-hidden border border-amber/25 bg-void/60">
                {person.profileUrl && (
                  <img src={person.profileUrl} alt={person.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-black tracking-[0.06em] text-ice">
                  {person.name}
                </div>
                <div className="mt-1 space-y-0.5 font-mono text-[0.58rem] text-cyan/55">
                  {person.birthday && (
                    <div>
                      GEBOREN {new Date(person.birthday).toLocaleDateString('de-DE')}
                      {!person.deathday && ` · ${age(person.birthday, null)} JAHRE`}
                    </div>
                  )}
                  {person.deathday && (
                    <div>GESTORBEN {new Date(person.deathday).toLocaleDateString('de-DE')}</div>
                  )}
                  {person.placeOfBirth && <div className="truncate">{person.placeOfBirth}</div>}
                  {person.knownForDepartment && <div>{person.knownForDepartment.toUpperCase()}</div>}
                </div>
                <div className="mt-2">
                  <HudButton small variant="ghost" onClick={() => setPerson(null)}>
                    Zurück zur Suche
                  </HudButton>
                </div>
              </div>
            </div>

            {person.biography && (
              <p className="mt-3 max-h-32 overflow-y-auto border-t border-amber/12 pt-3 text-[0.78rem] leading-relaxed text-ice/70">
                {person.biography}
              </p>
            )}

            {/* upcoming — the closest thing TMDB has to "was kommt als Nächstes" */}
            <div className="mt-4 border-t border-amber/12 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="hud-label" style={{ color: 'rgba(255,181,77,0.7)' }}>
                  Kommend / angekündigt
                </span>
                <StatusPill tone="amber" pulse={false}>
                  {upcoming.length}
                </StatusPill>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-[0.74rem] text-ice/50">
                  Bei TMDB ist aktuell nichts Kommendes eingetragen.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.slice(0, 8).map((c) => (
                    <div
                      key={`${c.mediaType}-${c.id}-${c.character}`}
                      className="flex items-center gap-2.5 border border-amber/14 bg-amber/[0.04] p-1.5"
                    >
                      <span className="h-11 w-8 shrink-0 overflow-hidden border border-amber/15 bg-void/60">
                        {c.posterUrl && (
                          <img src={c.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[0.66rem] font-bold text-ice">
                          {c.title}
                        </span>
                        <span className="block truncate font-mono text-[0.52rem] text-cyan/45">
                          {c.character || '—'}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[0.55rem] text-amber/80">
                        {fmtDate(c.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* filmography */}
            <div className="mt-4 border-t border-amber/12 pt-3">
              <div className="hud-label mb-2">Bekannt aus</div>
              <div className="flex flex-wrap gap-1.5">
                {shown.map((c) => (
                  <span
                    key={`${c.mediaType}-${c.id}-${c.character}`}
                    className="border border-cyan/15 bg-cyan/[0.03] px-2 py-1 font-mono text-[0.56rem] text-cyan/70"
                  >
                    {c.title}
                    <span className="ml-1 text-cyan/35">
                      {c.date ? c.date.slice(0, 4) : ''}
                    </span>
                  </span>
                ))}
              </div>
              {past.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllCredits((v) => !v)}
                  className="mt-2 font-mono text-[0.55rem] tracking-[0.16em] text-cyan/45 hover:text-cyan"
                >
                  {showAllCredits ? 'WENIGER ZEIGEN' : `ALLE ${past.length} ZEIGEN`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </HoloCard>
  )
}
