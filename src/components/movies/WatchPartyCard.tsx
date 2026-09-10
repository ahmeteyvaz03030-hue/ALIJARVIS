import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useOwnerFeed } from '../../state/useOwnerFeed'
import { EASE } from '../../lib/motion'
import { HoloCard } from '../hud/HoloCard'
import { HudButton } from '../hud/HudButton'

function parts(ms: number) {
  const clamped = Math.max(0, ms)
  return {
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor((clamped % 86_400_000) / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
  }
}

/**
 * The next announced film night.
 *
 * It reads the same owner channel the comms view does, so a film announced
 * once shows up wherever it is relevant — here, in the cinema module and in
 * RonalJarvis's briefing — without being entered three times.
 */
export function WatchPartyCard({
  index = 0,
  className,
  onOpenChannel,
}: {
  index?: number
  className?: string
  onOpenChannel?: () => void
}) {
  const feed = useOwnerFeed(true)
  const [now, setNow] = useState(() => Date.now())
  const [trailer, setTrailer] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const next = feed.messages
    .filter((m) => m.kind === 'watchparty' && m.event)
    .sort((a, b) => (a.event?.startsAt ?? 0) - (b.event?.startsAt ?? 0))
    .find((m) => (m.event?.startsAt ?? 0) + 4 * 3_600_000 > now)

  if (!next?.event) return null

  const { days, hours, minutes, seconds } = parts(next.event.startsAt - now)
  const running = next.event.startsAt <= now

  return (
    <HoloCard
      index={index}
      tone="violet"
      title="Filmabend"
      status={running ? 'LÄUFT' : 'ANGEKÜNDIGT'}
      className={className}
      scan
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        {next.film?.posterUrl && (
          <img
            src={next.film.posterUrl}
            alt=""
            loading="lazy"
            className="h-40 w-28 shrink-0 self-start border border-cyan/20 object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="font-display text-[1.05rem] font-black leading-tight text-ice">
            {next.film?.title ?? 'Filmabend'}
            {next.film?.year ? <span className="text-cyan/40"> · {next.film.year}</span> : null}
          </div>

          {next.text && (
            <p className="mt-1.5 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-ice/70">
              {next.text}
            </p>
          )}

          {/* countdown */}
          <div className="mt-3 flex items-baseline gap-1 font-display font-black tabular-nums text-violet">
            {running ? (
              <span className="text-lg text-lime">JETZT — VIEL SPASS</span>
            ) : (
              <>
                <span className="text-2xl">{days}</span>
                <span className="text-[0.6rem] text-violet/60">T</span>
                <span className="text-2xl">{String(hours).padStart(2, '0')}</span>
                <span className="text-[0.6rem] text-violet/60">H</span>
                <span className="text-2xl">{String(minutes).padStart(2, '0')}</span>
                <span className="text-[0.6rem] text-violet/60">M</span>
                <span className="text-2xl">{String(seconds).padStart(2, '0')}</span>
                <span className="text-[0.6rem] text-violet/60">S</span>
              </>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-violet/12 pt-3 sm:grid-cols-3">
            {[
              [
                'WANN',
                new Date(next.event.startsAt).toLocaleString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              ],
              ['WO', next.event.place || '—'],
              ...(next.event.note ? [['DAZU', next.event.note]] : []),
              ...(next.event.seat ? [['PLATZ', next.event.seat]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <div className="hud-label text-[0.42rem]">{k}</div>
                <div className="font-display text-[0.74rem] font-bold leading-tight text-ice">
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {next.film?.trailerKey && (
              <HudButton small variant="primary" onClick={() => setTrailer((t) => !t)}>
                {trailer ? 'Trailer schließen' : 'Trailer ansehen'}
              </HudButton>
            )}
            {onOpenChannel && (
              <HudButton small variant="ghost" onClick={onOpenChannel}>
                Zum Kanal
              </HudButton>
            )}
          </div>
        </div>
      </div>

      {trailer && next.film?.trailerKey && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, ease: EASE.out }}
          className="mt-3 overflow-hidden"
        >
          <div className="aspect-video w-full overflow-hidden border border-cyan/25 bg-black">
            <iframe
              title={`Trailer ${next.film.title}`}
              src={`https://www.youtube.com/embed/${next.film.trailerKey}?autoplay=1&rel=0`}
              className="h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </motion.div>
      )}
    </HoloCard>
  )
}
