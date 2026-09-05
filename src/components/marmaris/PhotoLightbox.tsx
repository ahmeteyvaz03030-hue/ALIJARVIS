import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import type { WikiImage } from '../../lib/wikiImages'
import { HudButton } from '../hud/HudButton'

// three.js only loads if a panorama is actually opened.
const PanoramaViewer = lazy(() =>
  import('./PanoramaViewer').then((m) => ({ default: m.PanoramaViewer })),
)

export function PhotoLightbox({
  images,
  index,
  title,
  onClose,
  onIndexChange,
}: {
  images: WikiImage[]
  index: number
  title: string
  onClose: () => void
  onIndexChange: (next: number) => void
}) {
  const { calm, cue } = useSystem()
  const [panoMode, setPanoMode] = useState(false)
  const image = images[index]

  const step = useCallback(
    (delta: number) => {
      if (images.length < 2) return
      cue('nav')
      setPanoMode(false)
      onIndexChange((index + delta + images.length) % images.length)
    },
    [cue, images.length, index, onIndexChange],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  if (!image) return null
  const showPano = panoMode && image.panorama && image.fullUrl

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center p-3 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="absolute inset-0 bg-void/93" onClick={onClose} />

      {/* header */}
      <div className="relative z-10 mb-3 flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[0.78rem] font-black tracking-[0.16em] text-ice">
            {title}
          </div>
          <div className="mt-0.5 truncate font-mono text-[0.55rem] tracking-[0.12em] text-cyan/45">
            {image.title} · {index + 1} / {images.length}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {image.panorama && image.fullUrl && (
            <HudButton
              small
              variant={showPano ? 'primary' : 'ghost'}
              onClick={() => setPanoMode((p) => !p)}
            >
              360°
            </HudButton>
          )}
          <HudButton small variant="ghost" onClick={onClose}>
            Schließen
          </HudButton>
        </div>
      </div>

      {/* stage */}
      <div className="relative z-10 flex w-full max-w-5xl flex-1 items-center justify-center overflow-hidden border border-cyan/20 bg-black">
        <AnimatePresence mode="wait">
          {showPano ? (
            <Suspense
              key="pano"
              fallback={
                <div className="flex h-full w-full items-center justify-center font-mono text-[0.6rem] tracking-[0.24em] text-cyan/50">
                  LADE 360°-ANSICHT...
                </div>
              }
            >
              <PanoramaViewer src={image.fullUrl!} className="h-full min-h-[50vh] w-full" />
            </Suspense>
          ) : (
            <motion.img
              key={image.url}
              src={image.fullUrl ?? image.url}
              alt={image.title}
              initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: calm ? 0.15 : 0.35, ease: EASE.out }}
              className="max-h-[74vh] w-auto max-w-full object-contain"
            />
          )}
        </AnimatePresence>

        {images.length > 1 && !showPano && (
          <>
            <NavArrow side="left" onClick={() => step(-1)} />
            <NavArrow side="right" onClick={() => step(1)} />
          </>
        )}
      </div>

      {/* filmstrip */}
      {images.length > 1 && (
        <div className="relative z-10 mt-3 flex w-full max-w-5xl gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => {
                setPanoMode(false)
                onIndexChange(i)
              }}
              className="relative h-14 w-20 shrink-0 overflow-hidden border transition-colors"
              style={{ borderColor: i === index ? 'rgba(53,230,255,0.8)' : 'rgba(53,230,255,0.18)' }}
            >
              <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              {img.panorama && (
                <span className="absolute bottom-0 right-0 bg-void/80 px-1 font-mono text-[0.4rem] text-cyan">
                  360
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <a
        href={image.pageUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="relative z-10 mt-2 font-mono text-[0.5rem] tracking-[0.14em] text-cyan/35 hover:text-cyan/70"
      >
        QUELLE: WIKIMEDIA COMMONS
      </a>
    </motion.div>
  )
}

function NavArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Vorheriges Bild' : 'Nächstes Bild'}
      className={`absolute top-1/2 -translate-y-1/2 border border-cyan/25 bg-void/70 px-3 py-4 font-mono text-cyan/70 transition-colors hover:border-cyan/70 hover:text-cyan ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}
