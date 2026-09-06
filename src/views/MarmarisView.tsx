import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { DESTINATION } from '../lib/config'
import { EASE, calmPanelVariants, panelVariants } from '../lib/motion'
import { useHoloTilt } from '../lib/hooks'
import { getCommonsGallery, getLandmarkImage, type WikiImage } from '../lib/wikiImages'
import { PhotoLightbox } from '../components/marmaris/PhotoLightbox'
import { HoloCard } from '../components/hud/HoloCard'
import { CurrencyConverter } from '../components/money/CurrencyConverter'
import { StatusPill } from '../components/hud/Readout'
import { Radar } from '../components/sim/Radar'
import { WeatherPanel } from '../components/weather/WeatherPanel'
import { KIND_TONE, MARMARIS_FACTS, POIS, type Poi } from '../data/marmaris'

const TONE_RGB = { cyan: '53,230,255', lime: '124,255,155', amber: '255,181,77' }

/** Fetches a real landmark photo once per POI; resolves to `null` on any
 *  failure so the card can fall back to the procedural placeholder. */
function usePoiPhoto(poi: Poi): WikiImage | null | 'loading' {
  const [photo, setPhoto] = useState<WikiImage | null | 'loading'>('loading')
  useEffect(() => {
    let cancelled = false
    setPhoto('loading')
    void getLandmarkImage(poi.wiki).then((result) => {
      if (!cancelled) setPhoto(result)
    })
    return () => {
      cancelled = true
    }
  }, [poi])
  return photo
}

function PoiPhoto({ poi, rgb }: { poi: Poi; rgb: string }) {
  const photo = usePoiPhoto(poi)

  if (photo && photo !== 'loading') {
    return (
      <>
        <img
          src={photo.url}
          alt={poi.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/holo:scale-[1.06]"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(4,8,13,0.92), rgba(4,8,13,0.15) 55%, transparent)' }}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/holo:opacity-100">
          <span className="border border-ice/40 bg-void/70 px-2 py-1 font-display text-[0.5rem] font-bold tracking-[0.2em] text-ice">
            ⤢ GALERIE ÖFFNEN
          </span>
        </span>
      </>
    )
  }

  // No real photo (not found, or still loading) — a deliberate placeholder,
  // not empty space: the POI's category rendered as oversized HUD texture.
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(150deg, rgba(${rgb},0.22), rgba(4,12,18,0.94))` }}
    >
      <span
        className="select-none font-display text-2xl font-black tracking-[0.1em] opacity-[0.14]"
        style={{ color: `rgb(${rgb})` }}
      >
        {poi.kind}
      </span>
      {photo === 'loading' && (
        <motion.span
          className="absolute inset-0"
          style={{ background: `linear-gradient(100deg, transparent 40%, rgba(${rgb},0.16) 50%, transparent 60%)` }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

function PoiCard({
  poi,
  index,
  active,
  onSelect,
  onOpenGallery,
}: {
  poi: Poi
  index: number
  active: boolean
  onSelect: () => void
  onOpenGallery: () => void
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
        className="panel-cut-sm relative flex h-full flex-col overflow-hidden border transition-colors duration-300"
        style={{
          borderColor: active ? `rgba(${rgb},0.7)` : `rgba(${rgb},0.2)`,
          background: 'rgb(10,26,38)',
          transform: calm ? undefined : 'rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))',
          transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1), border-color 300ms ease',
          willChange: 'transform',
        }}
      >
        <div
          className="relative h-24 shrink-0 cursor-zoom-in overflow-hidden border-b"
          style={{ borderColor: `rgba(${rgb},0.18)` }}
          onClick={(e) => {
            e.stopPropagation()
            onOpenGallery()
          }}
        >
          <PoiPhoto poi={poi} rgb={rgb} />
          <span
            className="absolute left-2 top-2 border px-1.5 py-0.5 font-display text-[0.44rem] font-black tracking-[0.14em]"
            style={{ borderColor: `rgba(${rgb},0.5)`, color: `rgb(${rgb})`, background: 'rgba(4,8,13,0.7)' }}
          >
            {poi.kind}
          </span>
          <span className="absolute right-2 top-2 font-mono text-[0.55rem] tabular-nums text-ice/80" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {poi.distanceKm.toFixed(1)} KM
          </span>
        </div>

        <div className="relative flex-1 p-3">
          <div
            className="holo-sheen"
            style={{
              background: `radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(${rgb},0.18), transparent 60%)`,
            }}
          />
          <div
            className="relative font-display text-[0.7rem] font-black tracking-[0.1em]"
            style={{ color: `rgb(${rgb})` }}
          >
            {poi.name}
          </div>
          <div className="relative mt-0.5 font-mono text-[0.5rem] tracking-[0.18em] text-cyan/45">
            BRG {String(poi.bearing).padStart(3, '0')}°
          </div>
          <p className="relative mt-2 text-[0.76rem] leading-relaxed text-ice/65">{poi.note}</p>
        </div>

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
  const { calm, cue, pushLog } = useSystem()
  const [selected, setSelected] = useState<string>(POIS[0].id)
  const [gallery, setGallery] = useState<{ poi: Poi; images: WikiImage[] } | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [loadingGallery, setLoadingGallery] = useState<string | null>(null)

  const openGallery = useCallback(
    async (poi: Poi) => {
      cue('confirm')
      setLoadingGallery(poi.id)
      // The card's own lead photo comes first, then whatever Commons has.
      const [lead, commons] = await Promise.all([
        getLandmarkImage(poi.wiki),
        getCommonsGallery(poi.commons),
      ])
      const seen = new Set<string>()
      const images = [...(lead ? [lead] : []), ...commons].filter((img) => {
        if (seen.has(img.url)) return false
        seen.add(img.url)
        return true
      })
      setLoadingGallery(null)
      if (images.length === 0) {
        pushLog(`Keine Fotos für ${poi.name} gefunden`, 'warn')
        return
      }
      setGalleryIndex(0)
      setGallery({ poi, images })
      pushLog(`Bildarchiv geöffnet — ${poi.name} (${images.length})`, 'info')
    },
    [cue, pushLog],
  )

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* --------------------------------------------------------- converter */}
      <CurrencyConverter index={0} className="lg:col-span-12" />

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
              onOpenGallery={() => void openGallery(poi)}
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

      <AnimatePresence>
        {gallery && (
          <PhotoLightbox
            key={gallery.poi.id}
            images={gallery.images}
            index={galleryIndex}
            title={gallery.poi.name}
            onIndexChange={setGalleryIndex}
            onClose={() => setGallery(null)}
          />
        )}
      </AnimatePresence>

      {loadingGallery && (
        <div className="fixed inset-0 z-[89] flex items-center justify-center bg-void/70">
          <div className="flex items-center gap-3 border border-cyan/25 bg-void/90 px-4 py-3">
            <motion.span
              className="h-4 w-4 rounded-full border border-cyan/25 border-t-cyan"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
            <span className="font-mono text-[0.6rem] tracking-[0.22em] text-cyan/70">
              LADE BILDARCHIV...
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
