import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useHoloTilt } from '../../lib/hooks'
import { calmPanelVariants, panelVariants } from '../../lib/motion'
import { MOVIES, type Movie } from '../../data/movies'
import { PosterArt } from './PosterArt'
import { MovieModal } from './MovieModal'

const STATUS_TONE: Record<Movie['status'], string> = {
  QUEUED: '53,230,255',
  DOWNLOADED: '124,255,155',
  WATCHING: '255,181,77',
}

function PosterCard({
  movie,
  index,
  onOpen,
}: {
  movie: Movie
  index: number
  onOpen: () => void
}) {
  const { calm, cue } = useSystem()
  const tilt = useHoloTilt(8, !calm)
  const rgb = STATUS_TONE[movie.status]

  return (
    <motion.button
      type="button"
      variants={calm ? calmPanelVariants : panelVariants}
      custom={index}
      onClick={() => {
        cue('confirm')
        onOpen()
      }}
      onPointerEnter={() => cue('panel')}
      className="group/holo relative block text-left"
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
        {/* base art */}
        <PosterArt
          art={movie.art}
          palette={movie.palette}
          seed={movie.title.length + index}
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
        <span className="absolute right-2 top-2 flex items-center gap-1 border border-cyan/25 bg-void/70 px-1.5 py-0.5 font-mono text-[0.5rem] text-ice">
          ★ {movie.rating.toFixed(1)}
        </span>

        {/* title block */}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <div className="font-display text-[0.66rem] font-black leading-tight tracking-[0.06em] text-ice">
            {movie.title}
          </div>
          <div className="mt-0.5 font-mono text-[0.5rem] tracking-[0.12em] text-cyan/55">
            {movie.year} · {movie.runtime} MIN
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
    </motion.button>
  )
}

export function MovieGrid() {
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
        {MOVIES.map((movie, i) => (
          <PosterCard
            key={movie.id}
            movie={movie}
            index={i}
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
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
