import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useDebouncedValue } from '../lib/hooks'
import { EASE } from '../lib/motion'
import { fetchNowPlaying, fetchPopular, getGenreMap, searchMovies } from '../lib/tmdb'
import { movieFromTmdb } from '../lib/tmdbMovies'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { SegmentBar, StatusPill } from '../components/hud/Readout'
import { MovieGrid } from '../components/movies/MovieGrid'
import { MOVIES, type Movie } from '../data/movies'

/** Static offline library — shown until an operator connects their own TMDB key. */
function DemoLibrary({ onOpenSettings }: { onOpenSettings: () => void }) {
  const offline = MOVIES.filter((m) => m.status === 'DOWNLOADED').length
  const totalMinutes = MOVIES.reduce((sum, m) => sum + m.runtime, 0)
  const avgRating = MOVIES.reduce((sum, m) => sum + m.rating, 0) / MOVIES.length

  return (
    <div className="space-y-3">
      <HoloCard index={0} tone="violet" title="Entertainment Database" status="OFFLINE-DEMO" scan>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: 'TITEL', v: String(MOVIES.length) },
            { k: 'OFFLINE', v: String(offline) },
            { k: 'LAUFZEIT', v: `${Math.round(totalMinutes / 60)} H` },
            { k: 'Ø RATING', v: avgRating.toFixed(1) },
          ].map((cell, i) => (
            <motion.div
              key={cell.k}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.42, ease: EASE.out }}
              className="border border-violet/18 bg-violet/[0.05] p-3"
            >
              <div className="hud-label mb-1" style={{ color: 'rgba(169,123,255,0.7)' }}>
                {cell.k}
              </div>
              <div className="font-display text-xl font-black tabular-nums text-ice">{cell.v}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-violet/12 pt-3">
          <div className="flex items-center justify-between">
            <span className="hud-label">Offline-Sync</span>
            <StatusPill tone="lime">{Math.round((offline / MOVIES.length) * 100)}%</StatusPill>
          </div>
          <SegmentBar value={(offline / MOVIES.length) * 100} segments={26} tone="lime" />
          <p className="text-[0.76rem] leading-relaxed text-ice/60">
            {offline} von {MOVIES.length} Titeln liegen lokal bereit. Für echte, aktuelle
            Kinofilme mit Suche einen eigenen TMDB-Schlüssel in den Einstellungen hinterlegen —
            kostenlos und in wenigen Sekunden verbunden.
          </p>
          <div className="pt-1">
            <HudButton small variant="ghost" onClick={onOpenSettings}>
              TMDB-Schlüssel hinterlegen
            </HudButton>
          </div>
        </div>
      </HoloCard>

      <div className="pt-1">
        <MovieGrid />
      </div>
    </div>
  )
}

type Mode = 'popular' | 'now_playing'

function dedupeById(list: Movie[]): Movie[] {
  const seen = new Set<string>()
  return list.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

/** Real, live entertainment index once an operator has connected a TMDB key. */
function LiveLibrary({ apiKey, onOpenSettings }: { apiKey: string; onOpenSettings: () => void }) {
  const { calm } = useSystem()
  const [mode, setMode] = useState<Mode>('popular')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 450)
  const searching = debouncedQuery.trim().length > 0

  const [genreMap, setGenreMap] = useState<Record<number, string> | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  // Genre id → name never changes for this key, so it's fetched once and
  // every list fetch below waits for it (falling back to {} on failure).
  useEffect(() => {
    void getGenreMap(apiKey).then(setGenreMap)
  }, [apiKey])

  const runFetch = useCallback(
    async (targetPage: number, append: boolean) => {
      const id = ++requestId.current
      const map = genreMap ?? {}
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      const result = searching
        ? await searchMovies(apiKey, debouncedQuery.trim(), targetPage)
        : mode === 'popular'
          ? await fetchPopular(apiKey, targetPage)
          : await fetchNowPlaying(apiKey, targetPage)

      if (id !== requestId.current) return // superseded by a newer request
      if (append) setLoadingMore(false)
      else setLoading(false)

      if (!result.ok) {
        setError(result.message)
        if (!append) setMovies([])
        return
      }

      const badge = searching ? 'SUCHE' : mode === 'popular' ? 'BELIEBT' : 'IM KINO'
      const mapped = result.data.results.map((item) => movieFromTmdb(item, map, badge))
      setMovies((prev) => (append ? dedupeById([...prev, ...mapped]) : mapped))
      setPage(result.data.page)
      setTotalPages(result.data.total_pages)
      setTotalResults(result.data.total_results)
    },
    [apiKey, debouncedQuery, genreMap, mode, searching],
  )

  // Refetch page 1 whenever the mode or the settled search query changes —
  // but only once the genre lookup has actually resolved, so titles carry
  // real genre names from the very first paint instead of flashing "FILM".
  useEffect(() => {
    if (genreMap === null) return
    void runFetch(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mode, debouncedQuery, genreMap])

  return (
    <div className="space-y-3">
      <HoloCard index={0} tone="violet" title="Kino-Datenbank" status="TMDB LIVE" scan>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filme durchsuchen..."
              aria-label="Filme durchsuchen"
              className="hud-input py-2 pr-9 text-[0.82rem]"
              style={{ letterSpacing: 'normal' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Suche löschen"
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan/50 hover:text-cyan"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <HudButton
              small
              variant={!searching && mode === 'popular' ? 'primary' : 'ghost'}
              onClick={() => {
                setQuery('')
                setMode('popular')
              }}
            >
              Beliebt
            </HudButton>
            <HudButton
              small
              variant={!searching && mode === 'now_playing' ? 'primary' : 'ghost'}
              onClick={() => {
                setQuery('')
                setMode('now_playing')
              }}
            >
              Im Kino
            </HudButton>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-violet/12 pt-3 font-mono text-[0.58rem] tracking-[0.16em] text-cyan/50">
          <StatusPill tone="lime">TMDB VERBUNDEN</StatusPill>
          <span>
            {searching ? `SUCHE „${debouncedQuery.trim()}"` : mode === 'popular' ? 'BELIEBTE FILME' : 'AKTUELL IM KINO'}
          </span>
          {totalResults > 0 && (
            <>
              <span className="text-cyan/25">·</span>
              <span>{totalResults.toLocaleString('de-DE')} TREFFER</span>
              <span className="text-cyan/25">·</span>
              <span>
                SEITE {page} / {totalPages}
              </span>
            </>
          )}
        </div>
      </HoloCard>

      {error && (
        <HoloCard index={1} tone="danger" title="Verbindungsfehler" status="TMDB">
          <p className="text-[0.82rem] leading-relaxed text-ice/75">{error}</p>
          <div className="mt-3">
            <HudButton variant="ghost" onClick={onOpenSettings}>
              Zu den Einstellungen
            </HudButton>
          </div>
        </HoloCard>
      )}

      {loading && movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <motion.div
            className="h-10 w-10 rounded-full border border-cyan/25 border-t-cyan"
            animate={calm ? undefined : { rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span className="font-mono text-[0.58rem] tracking-[0.24em] text-cyan/50">LADE FILMDATEN...</span>
        </div>
      ) : movies.length === 0 && !error ? (
        <div className="py-16 text-center font-mono text-[0.62rem] tracking-[0.2em] text-cyan/40">
          {searching ? `KEINE TREFFER FÜR „${debouncedQuery.trim()}"` : 'KEINE FILME GEFUNDEN'}
        </div>
      ) : (
        <>
          <MovieGrid movies={movies} apiKey={apiKey} />
          {page < totalPages && (
            <div className="flex justify-center pt-1">
              <HudButton variant="ghost" busy={loadingMore} onClick={() => void runFetch(page + 1, true)}>
                Mehr laden
              </HudButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function MoviesView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { settings } = useSystem()
  const apiKey = settings.tmdbApiKey
  return apiKey ? (
    <LiveLibrary apiKey={apiKey} onOpenSettings={onOpenSettings} />
  ) : (
    <DemoLibrary onOpenSettings={onOpenSettings} />
  )
}
