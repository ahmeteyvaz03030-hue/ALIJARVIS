import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import type { Movie } from '../../data/movies'
import { loadDetail, type TmdbDetailView } from '../../lib/tmdb'
import { HudButton } from '../hud/HudButton'
import { PosterArt, PosterImage } from './PosterArt'
import { ActiveScan } from '../fx/ScanLine'

/**
 * Trailer surface. With a real YouTube key (fetched from TMDB) it embeds the
 * actual trailer inside the same cinematic chrome; otherwise it falls back
 * to a simulated stream so demo movies still feel like something is playing.
 */
function TrailerOverlay({
  movie,
  trailerKey,
  onClose,
}: {
  movie: Movie
  trailerKey: string | null
  onClose: () => void
}) {
  const { calm, cue } = useSystem()
  const [progress, setProgress] = useState(0)
  const [buffering, setBuffering] = useState(!trailerKey)

  useEffect(() => {
    cue('process')
    if (trailerKey) return
    const boot = window.setTimeout(() => setBuffering(false), calm ? 200 : 1200)
    const tick = window.setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.45))
    }, 100)
    return () => {
      window.clearTimeout(boot)
      window.clearInterval(tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A real trailer plays inside the same cinematic frame, but with none of
  // the fabricated progress bar / waveform — we don't control that player.
  if (trailerKey) {
    return (
      <motion.div
        className="absolute inset-0 z-20 flex flex-col bg-void"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: calm ? 0.2 : 0.62, ease: EASE.rail }}
      >
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          <AnimatePresence>
            {buffering && (
              <motion.div
                className="absolute inset-0 z-10 flex items-center justify-center bg-void"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  className="h-9 w-9 rounded-full border-2 border-cyan/25 border-t-cyan"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="aspect-video w-full max-w-4xl">
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
              title={`${movie.title} — Trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              onLoad={() => setBuffering(false)}
              className="h-full w-full border-0"
            />
          </div>
          {!calm && <ActiveScan />}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-cyan/20 bg-void/90 px-4 py-3">
          <div className="min-w-0 truncate font-mono text-[0.58rem] tracking-[0.18em] text-cyan/60">
            {movie.title} · YOUTUBE TRAILER
          </div>
          <HudButton small variant="ghost" onClick={onClose}>
            Schließen
          </HudButton>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="absolute inset-0 z-20 flex flex-col bg-void"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: calm ? 0.2 : 0.62, ease: EASE.rail }}
    >
      {/* stage */}
      <div className="relative flex-1 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.16, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: calm ? 0.2 : 2.4, ease: EASE.out }}
        >
          <PosterArt art={movie.art} palette={movie.palette} seed={9} className="h-full w-full opacity-60" />
        </motion.div>

        {/* letterbox bars */}
        <motion.div
          className="absolute inset-x-0 top-0 bg-void"
          initial={{ height: '50%' }}
          animate={{ height: '9%' }}
          transition={{ duration: calm ? 0.2 : 0.9, ease: EASE.out }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 bg-void"
          initial={{ height: '50%' }}
          animate={{ height: '9%' }}
          transition={{ duration: calm ? 0.2 : 0.9, ease: EASE.out }}
        />

        {!calm && <ActiveScan />}

        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {buffering ? (
              <motion.div
                key="buffer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <motion.div
                  className="mx-auto mb-3 h-9 w-9 rounded-full border-2 border-cyan/25 border-t-cyan"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                />
                <div className="font-mono text-[0.6rem] tracking-[0.3em] text-cyan/70">
                  BUFFERING TRAILER STREAM
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="title"
                initial={{ opacity: 0, scale: 1.1, letterSpacing: '0.6em' }}
                animate={{ opacity: 1, scale: 1, letterSpacing: '0.18em' }}
                transition={{ duration: 1.1, ease: EASE.out }}
                className="px-6 text-center font-display text-xl font-black text-ice text-glow-strong sm:text-4xl"
              >
                {movie.title}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* player chrome */}
      <div className="shrink-0 border-t border-cyan/20 bg-void/90 px-4 py-3">
        <div className="mb-2 h-1 w-full bg-cyan/12">
          <motion.div
            className="h-full bg-cyan"
            style={{ width: `${progress}%`, boxShadow: '0 0 10px #35e6ff' }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-[0.58rem] tracking-[0.18em] text-cyan/60">
            <span className="tabular-nums">
              {String(Math.floor((progress / 100) * 2.4)).padStart(2, '0')}:
              {String(Math.floor(((progress / 100) * 144) % 60)).padStart(2, '0')}
            </span>
            <span className="text-cyan/25">/ 02:24</span>
            <span className="hidden sm:inline">· SIMULATED STREAM</span>
          </div>
          {/* waveform */}
          <div className="flex flex-1 items-end justify-center gap-[2px]">
            {Array.from({ length: 28 }, (_, i) => (
              <motion.span
                key={i}
                className="w-[2px] bg-cyan/60"
                animate={
                  calm || buffering
                    ? { height: 3 }
                    : { height: [3, 4 + ((i * 7) % 13), 3] }
                }
                transition={{
                  duration: 0.7 + (i % 5) * 0.12,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
          <HudButton small variant="ghost" onClick={onClose}>
            Schließen
          </HudButton>
        </div>
      </div>
    </motion.div>
  )
}

export function MovieModal({
  movie,
  apiKey = null,
  onClose,
}: {
  movie: Movie
  /** When set and `movie.tmdbId` is present, fetches runtime/tagline/trailer on open. */
  apiKey?: string | null
  onClose: () => void
}) {
  const { calm, cue, pushLog } = useSystem()
  const [trailer, setTrailer] = useState(false)
  const [detail, setDetail] = useState<TmdbDetailView | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // TMDB's list endpoints don't carry runtime, tagline or trailers — only
  // the detail endpoint does, so it's fetched lazily right when the
  // operator actually opens a card, not for the whole grid up front.
  useEffect(() => {
    if (!apiKey || !movie.tmdbId) return
    let cancelled = false
    setDetailLoading(true)
    void loadDetail(apiKey, movie.tmdbId).then((result) => {
      if (cancelled) return
      setDetailLoading(false)
      if (result) setDetail(result)
      else pushLog('TMDB-Detailabruf fehlgeschlagen', 'warn')
    })
    return () => {
      cancelled = true
    }
  }, [apiKey, movie.tmdbId, pushLog])

  const runtime = detail?.runtime || movie.runtime
  const tagline = detail?.tagline || movie.tagline
  const genre = detail?.genre || movie.genre
  const trailerKey = detail?.trailerKey ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (trailer) setTrailer(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, trailer])

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="absolute inset-0 bg-void/85 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        layoutId={calm ? undefined : `poster-${movie.id}`}
        className="panel panel-cut relative z-10 flex max-h-[88vh] min-h-[26rem] w-full max-w-3xl flex-col overflow-hidden sm:min-h-[30rem]"
        initial={calm ? { opacity: 0, scale: 0.96 } : undefined}
        animate={calm ? { opacity: 1, scale: 1 } : undefined}
        transition={{ type: 'spring', stiffness: 210, damping: 26 }}
      >
        <AnimatePresence>
          {trailer && (
            <TrailerOverlay movie={movie} trailerKey={trailerKey} onClose={() => setTrailer(false)} />
          )}
        </AnimatePresence>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-[minmax(0,15rem)_1fr]">
          {/* poster */}
          <div className="relative min-h-[16rem] overflow-hidden border-b border-cyan/12 sm:border-b-0 sm:border-r">
            <PosterImage movie={movie} className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="font-display text-[0.55rem] font-bold tracking-[0.24em] text-ice/70">
                {genre}
              </div>
            </div>
            {!calm && <ActiveScan />}
          </div>

          {/* details */}
          <div className="flex min-w-0 flex-col p-5">
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45, ease: EASE.out }}
              className="font-display text-xl font-black leading-tight tracking-[0.08em] text-ice text-glow sm:text-2xl"
            >
              {movie.title}
            </motion.h2>
            {tagline && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.4 }}
                className="mt-1 font-mono text-[0.62rem] italic tracking-[0.1em] text-cyan/60"
              >
                «{tagline}»
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.45 }}
              className="mt-4 grid grid-cols-3 gap-2 border-y border-cyan/12 py-2.5"
            >
              {[
                ['JAHR', movie.year ? String(movie.year) : '—'],
                ['LAUFZEIT', runtime > 0 ? `${runtime} MIN` : detailLoading ? '···' : '—'],
                ['RATING', movie.rating.toFixed(1)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="hud-label mb-0.5">{k}</div>
                  <div className="font-display text-[0.78rem] font-bold text-cyan">{v}</div>
                </div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.45 }}
              className="mt-4 text-[0.85rem] leading-relaxed text-ice/75"
            >
              {movie.synopsis}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.45 }}
              className="mt-auto flex flex-wrap gap-2 pt-5"
            >
              <HudButton
                variant="primary"
                busy={detailLoading}
                onClick={() => {
                  setTrailer(true)
                  cue('confirm')
                }}
              >
                {trailerKey ? 'Trailer starten' : 'Trailer starten (simuliert)'}
              </HudButton>
              <HudButton variant="ghost" onClick={onClose}>
                Zurück
              </HudButton>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
