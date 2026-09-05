import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useHoloTilt } from '../../lib/hooks'
import { calmPanelVariants, panelVariants } from '../../lib/motion'
import { useWatchlist } from '../../state/useWatchlist'
import { MOVIES, statusTone, type Movie } from '../../data/movies'
import { PosterImage } from './PosterArt'
import { MovieModal } from './MovieModal'

function PosterCard({
  movie,
  index,
  mediaType,
  onOpen,
}: {
  movie: Movie
  index: number
  mediaType: 'movie' | 'tv'
  onOpen: () => void
}) {
  const { calm, cue } = useSystem()
  const watchlist = useWatchlist()
  const tilt = useHoloTilt(8, !calm)
  const rgb = statusTone(movie.status)
  const saved = watchlist.has(movie.id)

  return (
    <motion.div
      variants={calm ? calmPanelVariants : panelVariants}
      custom={index}
      className="group/holo relative"
    >
      {/* The whole poster is the open-details control; the watchlist toggle is a
          sibling on top of it, never nested inside another button. */}
      <button
        type="button"
        onClick={() => {
          cue('confirm')
          onOpen()
        }}
        onPointerEnter={() => cue('panel')}
        className="block w-full text-left"
        style={{ perspective: 900 }}
      >
      <motion.div
        layoutId={calm ? undefined : `poster-${movie.id}`}
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className="panel-cut-sm relative aspect-[2/3] overflow-hidden border border-cyan/18"
        style={{
          transform: calm ? undefined : 'rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))',
          transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
          willChange: 'transform',
        }}
      >
        {/* real poster when TMDB supplied one; procedural art otherwise or on load failure */}
        <PosterImage
          movie={movie}
          index={index}
          className="absolute inset-0 h-full w-full transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/holo:scale-[1.09]"
        />

        {/* backdrop bloom that fades in on hover */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/holo:opacity-100"
          style={{
            background: `radial-gradient(120% 80% at 50% 20%, ${movie.palette[0]}55, transparent 65%)`,
          }}
        />
        <div className="holo-sheen" />

        {/* moving border on hover */}
        {!calm && (
          <span className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover/holo:opacity-100">
            <span
              className="absolute left-0 top-0 h-px w-1/2"
              style={{
                background: 'linear-gradient(90deg, transparent, #eafcff, transparent)',
                animation: 'jv-shimmer 2.2s linear infinite',
              }}
            />
            <span
              className="absolute bottom-0 right-0 h-px w-1/2"
              style={{
                background: 'linear-gradient(90deg, transparent, #eafcff, transparent)',
                animation: 'jv-shimmer 2.2s linear infinite reverse',
              }}
            />
          </span>
        )}

        {/* status chip */}
        <span
          className="absolute left-2 top-2 border px-1.5 py-0.5 font-display text-[0.44rem] font-black tracking-[0.16em]"
          style={{
            borderColor: `rgba(${rgb},0.5)`,
            color: `rgb(${rgb})`,
            background: 'rgba(4,8,13,0.7)',
          }}
        >
          {movie.status}
        </span>

        {/* rating */}
        <span className="absolute right-2 top-8 flex items-center gap-1 border border-cyan/25 bg-void/70 px-1.5 py-0.5 font-mono text-[0.5rem] text-ice">
          ★ {movie.rating.toFixed(1)}
        </span>

        {/* title block */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <div className="font-display text-[0.66rem] font-black leading-tight tracking-[0.06em] text-ice">
            {movie.title}
          </div>
          <div className="mt-0.5 font-mono text-[0.5rem] tracking-[0.12em] text-cyan/55">
            {movie.year || '—'}{movie.runtime > 0 ? ` · ${movie.runtime} MIN` : ''}
          </div>
          {/* reveal-on-hover play affordance */}
          <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden">
            <motion.span
              className="font-display text-[0.48rem] font-bold tracking-[0.2em] text-cyan"
              initial={false}
              whileHover={undefined}
            >
              <span className="inline-block translate-y-2 opacity-0 transition-all duration-300 group-hover/holo:translate-y-0 group-hover/holo:opacity-100">
                ▶ DETAILS ÖFFNEN
              </span>
            </motion.span>
          </div>
        </div>
      </motion.div>
      </button>

      {/* watchlist toggle — sits above the poster, outside its button */}
      <button
        type="button"
        aria-label={saved ? 'Von der Merkliste entfernen' : 'Zur Merkliste hinzufügen'}
        title={saved ? 'Von der Merkliste entfernen' : 'Später ansehen'}
        onClick={() => {
          cue(saved ? 'nav' : 'confirm')
          watchlist.toggle(movie, mediaType)
        }}
        className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center border text-[0.6rem] leading-none transition-colors"
        style={{
          borderColor: saved ? 'rgba(255,181,77,0.8)' : 'rgba(53,230,255,0.3)',
          background: saved ? 'rgba(255,181,77,0.18)' : 'rgba(4,8,13,0.7)',
          color: saved ? '#ffb54d' : 'rgba(182,244,255,0.7)',
        }}
      >
        {saved ? '★' : '+'}
      </button>
    </motion.div>
  )
}

export function MovieGrid({
  movies = MOVIES,
  apiKey = null,
  mediaType = 'movie',
}: {
  /** Defaults to the offline demo library when no list is supplied. */
  movies?: Movie[]
  /** Lets the modal fetch full detail (runtime, tagline, trailer) for TMDB-backed movies. */
  apiKey?: string | null
  mediaType?: 'movie' | 'tv'
}) {
  const [selected, setSelected] = useState<Movie | null>(null)
  const { pushLog } = useSystem()

  return (
    <>
      <motion.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.05 }}
      >
        {movies.map((movie, i) => (
          <PosterCard
            key={movie.id}
            movie={movie}
            index={i}
            mediaType={mediaType}
            onOpen={() => {
              setSelected(movie)
              pushLog(`Entertainment index → ${movie.title}`, 'info')
            }}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {selected && (
          <MovieModal
            key={selected.id}
            movie={selected}
            apiKey={apiKey}
            mediaType={mediaType}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
