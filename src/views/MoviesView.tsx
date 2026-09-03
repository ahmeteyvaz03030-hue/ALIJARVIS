import { motion } from 'framer-motion'
import { useSystem } from '../state/SystemProvider'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { SegmentBar, StatusPill } from '../components/hud/Readout'
import { MovieGrid } from '../components/movies/MovieGrid'
import { MOVIES } from '../data/movies'

export function MoviesView() {
  const { calm } = useSystem()
  const offline = MOVIES.filter((m) => m.status === 'DOWNLOADED').length
  const totalMinutes = MOVIES.reduce((sum, m) => sum + m.runtime, 0)
  const avgRating = MOVIES.reduce((sum, m) => sum + m.rating, 0) / MOVIES.length

  return (
    <div className="space-y-3">
      <HoloCard
        index={0}
        tone="violet"
        title="Entertainment Database"
        status="INDEXED"
        scan
      >
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
              <div className="font-display text-xl font-black tabular-nums text-ice">
                {cell.v}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-violet/12 pt-3">
          <div className="flex items-center justify-between">
            <span className="hud-label">Offline-Sync</span>
            <StatusPill tone="lime">{Math.round((offline / MOVIES.length) * 100)}%</StatusPill>
          </div>
          <SegmentBar value={(offline / MOVIES.length) * 100} segments={26} tone="lime" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-[0.76rem] leading-relaxed text-ice/60"
          >
            {offline} von {MOVIES.length} Titeln liegen lokal bereit — genug für den Flug und
            zwei Abende auf der Terrasse. Poster werden prozedural gerendert, es sind keine
            externen Assets nötig.
          </motion.p>
        </div>
      </HoloCard>

      <div className="relative">
        {!calm && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-2 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, #a97bff, transparent)' }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="pt-3">
          <MovieGrid />
        </div>
      </div>
    </div>
  )
}
