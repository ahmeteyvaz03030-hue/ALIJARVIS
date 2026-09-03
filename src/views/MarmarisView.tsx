import { motion } from 'framer-motion'
import { useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { DESTINATION } from '../lib/config'
import { EASE, calmPanelVariants, panelVariants } from '../lib/motion'
import { useHoloTilt } from '../lib/hooks'
import { HoloCard } from '../components/hud/HoloCard'
import { StatusPill } from '../components/hud/Readout'
import { Radar } from '../components/sim/Radar'
import { WeatherPanel } from '../components/weather/WeatherPanel'
import { KIND_TONE, MARMARIS_FACTS, POIS, type Poi } from '../data/marmaris'

const TONE_RGB = { cyan: '53,230,255', lime: '124,255,155', amber: '255,181,77' }

function PoiCard({
  poi,
  index,
  active,
  onSelect,
}: {
  poi: Poi
  index: number
  active: boolean
  onSelect: () => void
}) {
  const { calm, cue } = useSystem()
  const tilt = useHoloTilt(6, !calm)
  const rgb = TONE_RGB[KIND_TONE[poi.kind]]

  return (
    <motion.button
      type="button"
      variants={calm ? calmPanelVariants : panelVariants}
      custom={index}
      onClick={() => {
        cue('nav')
        onSelect()
      }}
      onPointerEnter={() => cue('panel')}
      className="group/holo relative block w-full text-left"
      style={{ perspective: 900 }}
    >
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className="panel-cut-sm relative h-full overflow-hidden border p-3 transition-colors duration-300"
        style={{
          borderColor: active ? `rgba(${rgb},0.7)` : `rgba(${rgb},0.2)`,
          background: active
            ? `linear-gradient(150deg, rgba(${rgb},0.12), rgba(4,12,18,0.9))`
            : 'linear-gradient(150deg, rgba(10,26,38,0.7), rgba(4,12,18,0.9))',
          transform: calm ? undefined : 'rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))',
          transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1), border-color 300ms ease',
          willChange: 'transform',
        }}
      >
        <div
          className="holo-sheen"
          style={{
            background: `radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(${rgb},0.18), transparent 60%)`,
          }}
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className="font-display text-[0.7rem] font-black tracking-[0.1em]"
              style={{ color: `rgb(${rgb})` }}
            >
              {poi.name}
            </div>
            <div className="mt-0.5 font-mono text-[0.5rem] tracking-[0.18em] text-cyan/45">
              {poi.kind} · BRG {String(poi.bearing).padStart(3, '0')}°
            </div>
          </div>
          <span className="shrink-0 font-mono text-[0.62rem] tabular-nums text-ice/70">
            {poi.distanceKm.toFixed(1)} KM
          </span>
        </div>
        <p className="relative mt-2 text-[0.76rem] leading-relaxed text-ice/65">{poi.note}</p>
        {/* selection rail */}
        <motion.span
          className="absolute bottom-0 left-0 h-[2px]"
          style={{ background: `rgb(${rgb})`, boxShadow: `0 0 8px rgba(${rgb},0.8)` }}
          initial={false}
          animate={{ width: active ? '100%' : '0%' }}
          transition={{ duration: 0.45, ease: EASE.out }}
        />
      </div>
    </motion.button>
  )
}

export function MarmarisView() {
  const { calm } = useSystem()
  const [selected, setSelected] = useState<string>(POIS[0].id)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* ------------------------------------------------------------- radar */}
      <HoloCard
        index={0}
        tone="lime"
        title="Marmaris Area Scan"
        status="ACTIVE SWEEP"
        className="lg:col-span-5"
        bodyClassName="p-4"
        flat
      >
        <Radar
          markers={POIS.map((p) => ({
            label: p.short,
            angle: p.bearing,
            dist: p.radar,
            tone: KIND_TONE[p.kind],
          }))}
          size={300}
          period={5}
          label="RANGE 45 KM · 7 CONTACTS"
        />

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-cyan/10 pt-3">
          <div>
            <div className="hud-label mb-0.5">Koordinaten</div>
            <div className="font-mono text-[0.66rem] text-ice/80">
              {DESTINATION.lat.toFixed(4)}°N · {DESTINATION.lon.toFixed(4)}°E
            </div>
          </div>
          <div className="text-right">
            <div className="hud-label mb-0.5">Datenbank</div>
            <StatusPill tone="lime">ONLINE</StatusPill>
          </div>
        </div>
      </HoloCard>

      {/* --------------------------------------------------------------- POIs */}
      <div className="lg:col-span-7">
        <motion.div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.06 }}
        >
          {POIS.map((poi, i) => (
            <PoiCard
              key={poi.id}
              poi={poi}
              index={i}
              active={selected === poi.id}
              onSelect={() => setSelected(poi.id)}
            />
          ))}
        </motion.div>
      </div>

      {/* ------------------------------------------------------------ weather */}
      <div className="lg:col-span-5">
        <WeatherPanel index={2} />
      </div>

      {/* -------------------------------------------------------------- facts */}
      <HoloCard
        index={3}
        tone="amber"
        title="Destination Profile"
        status="TÜRKİYE"
        className="lg:col-span-7"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MARMARIS_FACTS.map((fact, i) => (
            <motion.div
              key={fact.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.06, duration: 0.42, ease: EASE.out }}
              className="border border-amber/15 bg-amber/[0.04] p-2.5"
            >
              <div className="hud-label mb-1" style={{ color: 'rgba(255,181,77,0.65)' }}>
                {fact.label}
              </div>
              <div className="font-display text-[0.76rem] font-bold tracking-[0.06em] text-ice">
                {fact.value}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 border-t border-amber/12 pt-3">
          <div className="hud-label mb-2" style={{ color: 'rgba(255,181,77,0.65)' }}>
            Sea State
          </div>
          <div className="relative h-16 overflow-hidden border border-amber/12 bg-void/40">
            {/* animated water lines */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-x-0"
                style={{
                  top: `${18 + i * 16}%`,
                  height: 1,
                  background:
                    'linear-gradient(90deg, transparent, rgba(53,230,255,0.55), transparent)',
                }}
                animate={calm ? undefined : { x: ['-40%', '40%'] }}
                transition={{
                  duration: 5 + i,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'easeInOut',
                }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center gap-6 font-mono text-[0.6rem] tracking-[0.16em] text-ice/75">
              <span>WELLEN 0.3 M</span>
              <span className="text-cyan/40">|</span>
              <span>SICHT 12 KM</span>
              <span className="text-cyan/40">|</span>
              <span>MEER 27°C</span>
            </div>
          </div>
        </div>
      </HoloCard>
    </div>
  )
}
